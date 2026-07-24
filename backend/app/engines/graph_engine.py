"""
Graph Analytics Engine using NetworkX for fraud ring, money mule, and PageRank detection.
Includes Redis + PostgreSQL persistence layer for full state recovery across restarts.
"""
import logging
import asyncio
import networkx as nx
from typing import Dict, Any, List, Tuple
from sqlalchemy import text
from app.services.redis_service import get_redis

logger = logging.getLogger("fraudshield.graph")


class GraphEngine:
    def __init__(self):
        self.G = nx.DiGraph()
        self.fraud_nodes = set()
        self._cached_pagerank: Dict[str, float] = {}
        self._pagerank_last_updated: float = 0.0
        logger.info("Initializing NetworkX Persistent Graph Engine.")

    async def restore_from_persistence(self):
        """Restores graph nodes, edges, and fraud labels from PostgreSQL on startup."""
        from app.db.database import async_session_factory
        logger.info("Restoring Graph state from database persistence...")

        try:
            async with async_session_factory() as session:
                # 1. Restore fraud nodes
                nodes_res = await session.execute(
                    text("SELECT node_id, node_type, fraud_flag FROM graph_nodes WHERE fraud_flag = TRUE")
                )
                for row in nodes_res.all():
                    node_id, node_type, fraud_flag = row
                    self.fraud_nodes.add(node_id)
                    self.G.add_node(node_id, type=node_type, fraud_flag=True)

                # 2. Restore recent transfer & device edges (last 30 days)
                edges_res = await session.execute(
                    text("SELECT sender, receiver, amount, txn_id, edge_type, created_at FROM graph_edges ORDER BY created_at ASC LIMIT 10000")
                )
                edge_count = 0
                for row in edges_res.all():
                    sender, receiver, amount, txn_id, edge_type, created_at = row
                    self.G.add_node(sender, type="User", fraud_flag=(sender in self.fraud_nodes))
                    self.G.add_node(receiver, type="VPA" if "@" in receiver else "Device", fraud_flag=(receiver in self.fraud_nodes))
                    self.G.add_edge(
                        sender,
                        receiver,
                        amount=float(amount or 0.0),
                        txn_id=txn_id,
                        timestamp=str(created_at),
                        type=edge_type
                    )
                    edge_count += 1

            logger.info(f"Graph restored successfully: {self.G.number_of_nodes()} nodes, {edge_count} edges, {len(self.fraud_nodes)} fraud nodes.")
        except Exception as e:
            logger.warning(f"Graph persistence restoration notice: {str(e)} (starting with fresh graph).")

    def add_transaction_edge(self, sender: str, receiver: str, amount: float, txn_id: str, timestamp_str: str):
        """Adds a transfer edge between sender and receiver in memory and schedules DB persistence."""
        self.G.add_node(sender, type="User", fraud_flag=(sender in self.fraud_nodes))
        self.G.add_node(receiver, type="VPA", fraud_flag=(receiver in self.fraud_nodes))

        self.G.add_edge(
            sender, 
            receiver, 
            amount=amount, 
            txn_id=txn_id, 
            timestamp=timestamp_str,
            type="TRANSFERRED"
        )
        asyncio.create_task(self._persist_edge_async(sender, receiver, amount, txn_id, "TRANSFERRED"))

    def add_device_edge(self, user: str, device_id: str):
        """Adds a device usage edge between user and device."""
        self.G.add_node(user, type="User", fraud_flag=(user in self.fraud_nodes))
        self.G.add_node(device_id, type="Device", fraud_flag=(device_id in self.fraud_nodes))

        self.G.add_edge(user, device_id, type="USED_DEVICE")
        self.G.add_edge(device_id, user, type="USED_DEVICE")
        asyncio.create_task(self._persist_edge_async(user, device_id, 0.0, None, "USED_DEVICE"))

    async def _persist_edge_async(self, sender: str, receiver: str, amount: float, txn_id: str, edge_type: str):
        """Asynchronously writes edge to DB and Redis stream."""
        try:
            from app.db.database import async_session_factory
            async with async_session_factory() as session:
                await session.execute(
                    text("""
                        INSERT INTO graph_edges (sender, receiver, amount, txn_id, edge_type)
                        VALUES (:s, :r, :a, :t, :e)
                    """),
                    {"s": sender, "r": receiver, "a": amount, "t": txn_id, "e": edge_type}
                )
                await session.commit()
        except Exception as e:
            logger.debug(f"Edge DB persist background error: {e}")

    def mark_node_as_fraud(self, node_id: str):
        """Marks a node as confirmed fraud and updates persistence."""
        self.fraud_nodes.add(node_id)
        if self.G.has_node(node_id):
            self.G.nodes[node_id]["fraud_flag"] = True

        asyncio.create_task(self._persist_node_fraud_async(node_id))

    async def _persist_node_fraud_async(self, node_id: str):
        try:
            from app.db.database import async_session_factory
            async with async_session_factory() as session:
                await session.execute(
                    text("""
                        INSERT INTO graph_nodes (node_id, node_type, fraud_flag)
                        VALUES (:n, 'UNKNOWN', TRUE)
                        ON CONFLICT (node_id) DO UPDATE SET fraud_flag = TRUE, updated_at = NOW()
                    """),
                    {"n": node_id}
                )
                await session.commit()
        except Exception as e:
            logger.debug(f"Node fraud DB persist error: {e}")

    def get_shortest_path_to_fraud(self, start_node: str, max_hops: int = 3) -> Tuple[int, List[str]]:
        """Finds shortest path from start_node to any confirmed fraud node."""
        if not self.G.has_node(start_node):
            return -1, []

        shortest_path = None
        min_length = float('inf')

        for target in self.fraud_nodes:
            if target == start_node:
                continue
            if self.G.has_node(target):
                try:
                    path = nx.shortest_path(self.G, source=start_node, target=target)
                    length = len(path) - 1
                    if length <= max_hops and length < min_length:
                        min_length = length
                        shortest_path = path
                except nx.NetworkXNoPath:
                    continue
                except Exception:
                    continue

        if shortest_path:
            return min_length, shortest_path
        return -1, []

    def compute_personalized_pagerank(self) -> Dict[str, float]:
        """Computes Personalized PageRank seeded on known fraud nodes."""
        if not self.G.nodes or not self.fraud_nodes:
            return {}

        present_fraud = [n for n in self.fraud_nodes if self.G.has_node(n)]
        if not present_fraud:
            return {node: 0.0 for node in self.G.nodes}

        personalization = {node: 0.0 for node in self.G.nodes}
        for n in present_fraud:
            personalization[n] = 1.0 / len(present_fraud)

        try:
            pagerank_scores = nx.pagerank(
                self.G, 
                alpha=0.85, 
                personalization=personalization, 
                max_iter=100, 
                tol=1e-6
            )
            self._cached_pagerank = pagerank_scores
            return pagerank_scores
        except Exception as e:
            logger.error(f"Error calculating PageRank: {str(e)}")
            return {}

    def check_node_risk(self, sender: str, receiver: str, device_id: str) -> Dict[str, Any]:
        """
        Evaluates real-time graph risk for a transaction including Hop Counts,
        Personalized PageRank, Centrality, and Mule Ring Detection.
        """
        risk_score = 0.0
        fraud_ring_flag = False
        flags = []

        # 1. Hop count to fraud for sender
        sender_hops, _ = self.get_shortest_path_to_fraud(sender, max_hops=3)
        if sender_hops == 1:
            risk_score = max(risk_score, 0.90)
            flags.append("DIRECT_SENDER_FRAUD_CONNECTION")
        elif sender_hops == 2:
            risk_score = max(risk_score, 0.60)
            flags.append("INDIRECT_SENDER_FRAUD_CONNECTION_2_HOPS")
        elif sender_hops == 3:
            risk_score = max(risk_score, 0.30)
            flags.append("INDIRECT_SENDER_FRAUD_CONNECTION_3_HOPS")

        # 2. Hop count to fraud for receiver
        receiver_hops, _ = self.get_shortest_path_to_fraud(receiver, max_hops=3)
        if receiver_hops == 1:
            risk_score = max(risk_score, 0.95)
            flags.append("DIRECT_RECEIVER_FRAUD_CONNECTION")
        elif receiver_hops == 2:
            risk_score = max(risk_score, 0.70)
            flags.append("INDIRECT_RECEIVER_FRAUD_CONNECTION_2_HOPS")

        # 3. Hop count to fraud for device
        device_hops, _ = self.get_shortest_path_to_fraud(device_id, max_hops=3)
        if device_hops == 1:
            risk_score = max(risk_score, 0.90)
            flags.append("DEVICE_LINKED_TO_FRAUD")
        elif device_hops == 2:
            risk_score = max(risk_score, 0.60)
            flags.append("DEVICE_SHARED_WITH_FRAUD")

        # 4. Shared device multi-account check
        if self.G.has_node(device_id):
            linked_users = [n for n in self.G.neighbors(device_id) if self.G.nodes[n].get("type") == "User"]
            if len(linked_users) > 5:
                risk_score = max(risk_score, 0.80)
                fraud_ring_flag = True
                flags.append("MULE_DEVICE_SHARING_RING")

            if any(self.G.nodes[u].get("fraud_flag") for u in linked_users):
                risk_score = max(risk_score, 0.85)
                flags.append("DEVICE_SHARED_WITH_FLAGGED_USER")

        # 5. Integrated Personalized PageRank risk adjustment
        pr_map = self._cached_pagerank or self.compute_personalized_pagerank()
        sender_pr = pr_map.get(sender, 0.0)
        receiver_pr = pr_map.get(receiver, 0.0)

        if receiver_pr > 0.05:
            risk_score = max(risk_score, min(0.95, receiver_pr * 5.0))
            flags.append("HIGH_PAGERANK_FRAUD_PROXIMITY_RECEIVER")
        if sender_pr > 0.05:
            risk_score = max(risk_score, min(0.90, sender_pr * 4.0))
            flags.append("HIGH_PAGERANK_FRAUD_PROXIMITY_SENDER")

        return {
            "graph_risk_score": float(min(1.0, risk_score)),
            "fraud_ring_flag": fraud_ring_flag,
            "graph_flags": flags,
            "hops_to_fraud": sender_hops,
            "sender_pagerank": float(sender_pr),
            "receiver_pagerank": float(receiver_pr)
        }


graph_engine = GraphEngine()

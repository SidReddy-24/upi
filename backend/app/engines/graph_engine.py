"""Graph Analytics Engine using NetworkX for fraud ring and money mule detection."""
import logging
import networkx as nx

logger = logging.getLogger("fraudshield.graph")

class GraphEngine:
    def __init__(self):
        self.G = nx.DiGraph()
        self.fraud_nodes = set()
        logger.info("Initializing NetworkX in-memory Graph Engine.")

    def add_transaction_edge(self, sender: str, receiver: str, amount: float, txn_id: str, timestamp_str: str):
        """Adds a transfer edge between sender and receiver."""
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

    def add_device_edge(self, user: str, device_id: str):
        """Adds a device usage edge between user and device."""
        self.G.add_node(user, type="User", fraud_flag=(user in self.fraud_nodes))
        self.G.add_node(device_id, type="Device", fraud_flag=(device_id in self.fraud_nodes))
        
        self.G.add_edge(user, device_id, type="USED_DEVICE")
        # Direct reverse edge for undirected traversal convenience
        self.G.add_edge(device_id, user, type="USED_DEVICE")

    def mark_node_as_fraud(self, node_id: str):
        """Marks a node as confirmed fraud and propagates state."""
        self.fraud_nodes.add(node_id)
        if self.G.has_node(node_id):
            self.G.nodes[node_id]["fraud_flag"] = True

    def clear_graph(self):
        self.G.clear()
        self.fraud_nodes.clear()

    def get_shortest_path_to_fraud(self, start_node: str, max_hops: int = 3) -> tuple[int, list[str]]:
        """
        Finds the shortest path from start_node to any confirmed fraud node.
        Returns a tuple of (hop_count, path_list). If no path, returns (-1, []).
        """
        if not self.G.has_node(start_node):
            return -1, []
            
        shortest_path = None
        min_length = float('inf')
        
        # Traverse up to max_hops BFS
        for target in self.fraud_nodes:
            if target == start_node:
                continue
            if self.G.has_node(target):
                try:
                    path = nx.shortest_path(self.G, source=start_node, target=target)
                    length = len(path) - 1 # edges count
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

    def compute_personalized_pagerank(self) -> dict[str, float]:
        """
        Computes Personalized PageRank seeded on known fraud nodes.
        Based on SRD Section 10.6.
        """
        if not self.G.nodes or not self.fraud_nodes:
            return {}
            
        # Filter fraud nodes present in graph
        present_fraud = [n for n in self.fraud_nodes if self.G.has_node(n)]
        if not present_fraud:
            return {node: 0.0 for node in self.G.nodes}
            
        # Equal distribution among known fraud nodes
        personalization = {node: 0.0 for node in self.G.nodes}
        for n in present_fraud:
            personalization[n] = 1.0 / len(present_fraud)
            
        try:
            # Personalised PageRank
            pagerank_scores = nx.pagerank(
                self.G, 
                alpha=0.85, 
                personalization=personalization, 
                max_iter=100, 
                tol=1e-6
            )
            return pagerank_scores
        except Exception as e:
            logger.error(f"Error calculating PageRank: {str(e)}")
            return {}

    def check_node_risk(self, sender: str, receiver: str, device_id: str) -> dict:
        """
        Evaluates real-time graph risk for a transaction.
        Checks for shared devices, distance to fraud, and PageRank scores.
        """
        risk_score = 0.0
        fraud_ring_flag = False
        flags = []
        
        # 1. Hop count to fraud for sender
        sender_hops, sender_path = self.get_shortest_path_to_fraud(sender, max_hops=3)
        if sender_hops == 1:
            risk_score = max(risk_score, 0.9)
            flags.append("DIRECT_SENDER_FRAUD_CONNECTION")
        elif sender_hops == 2:
            risk_score = max(risk_score, 0.6)
            flags.append("INDIRECT_SENDER_FRAUD_CONNECTION_2_HOPS")
        elif sender_hops == 3:
            risk_score = max(risk_score, 0.3)
            flags.append("INDIRECT_SENDER_FRAUD_CONNECTION_3_HOPS")
            
        # 2. Hop count to fraud for receiver
        receiver_hops, receiver_path = self.get_shortest_path_to_fraud(receiver, max_hops=3)
        if receiver_hops == 1:
            risk_score = max(risk_score, 0.95)
            flags.append("DIRECT_RECEIVER_FRAUD_CONNECTION")
        elif receiver_hops == 2:
            risk_score = max(risk_score, 0.7)
            flags.append("INDIRECT_RECEIVER_FRAUD_CONNECTION_2_HOPS")
            
        # 3. Hop count to fraud for device
        device_hops, device_path = self.get_shortest_path_to_fraud(device_id, max_hops=3)
        if device_hops == 1:
            risk_score = max(risk_score, 0.9)
            flags.append("DEVICE_LINKED_TO_FRAUD")
        elif device_hops == 2:
            risk_score = max(risk_score, 0.6)
            flags.append("DEVICE_SHARED_WITH_FRAUD")
            
        # 4. Shared device multi-account check
        if self.G.has_node(device_id):
            # Find all users linked to this device
            linked_users = [n for n in self.G.neighbors(device_id) if self.G.nodes[n].get("type") == "User"]
            if len(linked_users) > 5:
                risk_score = max(risk_score, 0.8)
                fraud_ring_flag = True
                flags.append("MULE_DEVICE_SHARING_RING")
                
            # If any of the users sharing the device is flagged
            if any(self.G.nodes[u].get("fraud_flag") for u in linked_users):
                risk_score = max(risk_score, 0.85)
                flags.append("DEVICE_SHARED_WITH_FLAGGED_USER")

        return {
            "graph_risk_score": risk_score,
            "fraud_ring_flag": fraud_ring_flag,
            "graph_flags": flags,
            "hops_to_fraud": sender_hops
        }


graph_engine = GraphEngine()

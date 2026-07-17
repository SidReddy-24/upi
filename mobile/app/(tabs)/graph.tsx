import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView
} from "react-native";
import { Colors } from "../../constants/Colors";

interface Node {
  id: string;
  type: "User" | "Device" | "VPA" | "Mule";
  x: number;
  y: number;
  label: string;
  risk: number;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
}

const INITIAL_NODES: Node[] = [
  { id: "u_rahul", type: "User", x: 100, y: 150, label: "rahul.sharma@upi", risk: 0.92 },
  { id: "d_attacker", type: "Device", x: 200, y: 240, label: "Device: Rooted Attacker", risk: 0.85 },
  { id: "u_mule", type: "Mule", x: 300, y: 150, label: "mule_account@upi", risk: 0.96 },
  { id: "u_amit", type: "User", x: 100, y: 50, label: "amit.patel@upi", risk: 0.05 },
  { id: "d_trusted", type: "Device", x: 50, y: 100, label: "Device: Trusted Rahul", risk: 0.02 },
];

const INITIAL_EDGES: Edge[] = [
  { from: "u_rahul", to: "d_attacker", label: "USED" },
  { from: "d_attacker", to: "u_mule", label: "USED BY MULE" },
  { from: "u_rahul", to: "u_mule", label: "TRANSFERRED ₹49,500" },
  { from: "u_amit", to: "d_trusted", label: "USED" },
  { from: "d_trusted", to: "u_rahul", label: "SHARED" },
];

export default function GraphExplorerScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(INITIAL_NODES[0]);

  const handleNodePress = (node: Node) => {
    setSelectedNode(node);
  };

  const getNodeColor = (type: string, risk: number) => {
    if (type === "Mule" || risk > 0.75) return Colors.risk.reject;
    if (type === "Device") return Colors.accent.secondary;
    if (risk > 0.35) return Colors.risk.review;
    return Colors.risk.approve;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by user_id, device_id, or VPA..."
          placeholderTextColor={Colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Pressable style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>Find</Text>
        </Pressable>
      </View>

      {/* Interactive SVG Graph Area */}
      <View style={styles.graphArea}>
        <svg width="100%" height="320" style={{ backgroundColor: Colors.bg.surface, borderRadius: 14, border: `1px solid ${Colors.bg.border}` }}>
          {/* Render Edges */}
          {edges.map((e, index) => {
            const fromNode = nodes.find(n => n.id === e.from);
            const toNode = nodes.find(n => n.id === e.to);
            if (!fromNode || !toNode) return null;
            return (
              <g key={index}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={Colors.bg.border}
                  strokeWidth="2"
                  strokeDasharray={e.label?.includes("TRANSFERRED") ? "none" : "4 4"}
                />
                <text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2 - 5}
                  fill={Colors.text.tertiary}
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map(n => {
            const isSelected = selectedNode?.id === n.id;
            const color = getNodeColor(n.type, n.risk);
            return (
              <g key={n.id} onClick={() => handleNodePress(n)} style={{ cursor: "pointer" }}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isSelected ? 16 : 12}
                  fill={color}
                  stroke={Colors.text.primary}
                  strokeWidth={isSelected ? 3 : 1}
                  style={{ transition: "all 0.2s" }}
                />
                <text
                  x={n.x}
                  y={n.y + 25}
                  fill={Colors.text.primary}
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {n.label.split("@")[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </View>

      {/* Selected Node Details */}
      {selectedNode && (
        <ScrollView style={styles.detailContainer}>
          <Text style={styles.detailTitle}>Node Profile Details</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Identity / ID</Text>
              <Text style={styles.detailVal}>{selectedNode.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Node Category</Text>
              <Text style={[styles.detailVal, { color: Colors.accent.primary }]}>{selectedNode.type.toUpperCase()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network Risk Score</Text>
              <Text style={[styles.detailVal, { color: getNodeColor(selectedNode.type, selectedNode.risk), fontWeight: "900" }]}>
                {(selectedNode.risk * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hops to Known Fraud</Text>
              <Text style={styles.detailVal}>{selectedNode.type === "Mule" ? "0 (Source)" : "1 hop"}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  searchRow: { flexDirection: "row", gap: 10, padding: 16, backgroundColor: Colors.bg.surface, borderBottomWidth: 1, borderBottomColor: Colors.bg.border },
  searchInput: { flex: 1, backgroundColor: Colors.bg.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: Colors.text.primary, fontSize: 13 },
  searchBtn: { backgroundColor: Colors.accent.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  searchBtnText: { fontSize: 13, fontWeight: "700", color: Colors.text.inverse },
  
  graphArea: { padding: 16 },
  
  detailContainer: { flex: 1, paddingHorizontal: 16 },
  detailTitle: { fontSize: 13, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 },
  detailCard: { backgroundColor: Colors.bg.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.bg.border, padding: 16, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { fontSize: 13, color: Colors.text.secondary },
  detailVal: { fontSize: 13, fontWeight: "700", color: Colors.text.primary },
});

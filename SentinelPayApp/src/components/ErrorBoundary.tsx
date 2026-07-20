/**
 * ErrorBoundary — Phase 8.1.4
 *
 * Catches uncaught JS errors anywhere in the component tree.
 * Shows a friendly fallback screen instead of a blank crash.
 * Includes a Reset button that clears error state so the user
 * can try again without restarting the app.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something Went Wrong</Text>
          <Text style={styles.subtitle}>
            SentinelPay encountered an unexpected error. Your wallet data is safe.
          </Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>Error Details</Text>
            <Text style={styles.errorText}>{this.state.errorMessage}</Text>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={this.handleReset}>
            <Text style={styles.resetBtnText}>↩ Try Again</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            If the problem persists, please restart the app.
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  errorBox: {
    width: '100%', backgroundColor: '#fee2e2', borderRadius: 12,
    padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#fecaca',
  },
  errorLabel: { fontSize: 11, fontWeight: '700', color: '#991b1b', marginBottom: 6, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: '#7f1d1d', fontFamily: 'monospace' },
  resetBtn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40, marginBottom: 16,
  },
  resetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
});

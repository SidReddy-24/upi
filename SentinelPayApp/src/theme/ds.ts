/**
 * SentinelPay Design System — Single Source of Truth
 * Extracted from HomeScreen.tsx — All screens MUST import from here.
 * Design Refs: Apple Wallet, Revolut, Linear, Stripe Dashboard
 * Theme: Deep Slate (#0F172A), Slate Surface (#F8FAFC), Emerald (#10B981), Cobalt (#2563EB)
 */
import { Dimensions, StyleSheet } from 'react-native';

const { width: W } = Dimensions.get('window');

// ─── COLOUR PALETTE ──────────────────────────────────────────────────────────
export const C = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  dark: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  green: '#10B981', greenLight: '#34D399', greenBg: '#ECFDF5',
  blue: '#2563EB', blueBg: '#EFF6FF',
  violet: '#7C3AED', violetBg: '#F5F3FF',
  amber: '#D97706', amberBg: '#FFFBEB',
  red: '#EF4444', redLight: '#F87171', redBg: '#FEF2F2',
} as const;

// ─── SPACING (8-pt grid) ─────────────────────────────────────────────────────
export const S = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32 } as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
export const T = {
  caption: 10, xs: 11, sm: 12, base: 13, body: 14, md: 15, lg: 16,
  xl: 18, xxl: 20, display: 32,
  regular: '400' as const, medium: '500' as const, semibold: '600' as const,
  bold: '700' as const, extrabold: '800' as const, black: '900' as const,
} as const;

// ─── RADIUS ──────────────────────────────────────────────────────────────────
export const R = {
  xs: 8, sm: 10, md: 12, lg: 16, xl: 18, xxl: 20, card: 24, full: 999,
} as const;

// ─── SHADOWS ─────────────────────────────────────────────────────────────────
export const shadow = {
  sm:   { shadowColor: C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.03, shadowRadius:4,  elevation:1 },
  md:   { shadowColor: C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:8,  elevation:2 },
  lg:   { shadowColor: C.dark, shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:3 },
  hero: { shadowColor: C.dark, shadowOffset:{width:0,height:8}, shadowOpacity:0.25, shadowRadius:16, elevation:6 },
} as const;

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
export const DS = StyleSheet.create({
  // ── Screen ──────────────────────────────────────────────────────────────────
  screen:    { flex:1, backgroundColor:C.bg },
  safeArea:  { flex:1, backgroundColor:C.bg },
  scrollContent: { paddingHorizontal:S.base, paddingTop:S.base, paddingBottom:100 },

  // ── Cards ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor:C.surface, borderRadius:R.xl, padding:S.base,
    marginBottom:S.md, borderWidth:1, borderColor:C.border,
    shadowColor:C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:8, elevation:2,
  },
  cardLg: {
    backgroundColor:C.surface, borderRadius:R.card, padding:S.xl,
    marginBottom:S.lg, borderWidth:1, borderColor:C.border,
    shadowColor:C.dark, shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:3,
  },
  heroCard: {
    backgroundColor:C.dark, borderRadius:R.card, padding:S.lg, marginBottom:S.base,
    shadowColor:C.dark, shadowOffset:{width:0,height:8}, shadowOpacity:0.25, shadowRadius:16, elevation:6,
  },
  infoCard: {
    flexDirection:'row', alignItems:'flex-start', backgroundColor:C.surfaceAlt,
    padding:S.base, borderRadius:R.lg, gap:S.md,
  },
  rowCard: {
    flexDirection:'row', alignItems:'center', backgroundColor:C.surface,
    borderRadius:R.xl, padding:S.base, marginBottom:S.md,
    borderWidth:1, borderColor:C.border, gap:S.md,
    shadowColor:C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.03, shadowRadius:4, elevation:1,
  },
  gridCard: {
    width: (W - 44) / 2, backgroundColor:C.surface, borderRadius:R.xl,
    padding:S.base, borderWidth:1, borderColor:C.border,
    shadowColor:C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:8, elevation:2,
  },
  // Stat card (for dashboards / summaries)
  statCard: {
    flex:1, backgroundColor:C.surface, borderRadius:R.xl, padding:S.base,
    alignItems:'center', borderWidth:1, borderColor:C.border,
    shadowColor:C.dark, shadowOffset:{width:0,height:2}, shadowOpacity:0.04, shadowRadius:6, elevation:2,
  },
  statsRow: {
    flexDirection:'row', gap:S.md, marginBottom:S.base,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  btn:         { height:52, borderRadius:R.md, alignItems:'center', justifyContent:'center', flexDirection:'row', gap:S.sm },
  btnPrimary:  { backgroundColor:C.dark },
  btnSuccess:  { backgroundColor:C.green },
  btnDanger:   { backgroundColor:C.red },
  btnWarning:  { backgroundColor:C.amber },
  btnOutline:  { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.border },
  btnOutlineGreen: { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.green },
  btnDisabled: { opacity:0.45 },
  btnText:     { fontSize:T.body, fontWeight:T.extrabold, color:C.textInverse },
  btnTextDark: { fontSize:T.body, fontWeight:T.extrabold, color:C.textPrimary },
  btnTextGreen:{ fontSize:T.body, fontWeight:T.extrabold, color:C.green },
  btnSm:       { height:40, borderRadius:R.md, paddingHorizontal:S.base, alignItems:'center', justifyContent:'center', flexDirection:'row', gap:S.sm },

  // ── Icon Circles ────────────────────────────────────────────────────────────
  iconSm: { width:36, height:36, borderRadius:R.sm,  alignItems:'center', justifyContent:'center' },
  iconMd: { width:44, height:44, borderRadius:R.md,  alignItems:'center', justifyContent:'center' },
  iconLg: { width:56, height:56, borderRadius:R.lg,  alignItems:'center', justifyContent:'center' },
  iconXl: { width:64, height:64, borderRadius:R.xl,  alignItems:'center', justifyContent:'center' },

  // ── Inputs ──────────────────────────────────────────────────────────────────
  inputWrapper: {
    backgroundColor:C.surface, borderRadius:R.md, borderWidth:1, borderColor:C.border,
    flexDirection:'row', alignItems:'center', paddingHorizontal:S.base, height:52, marginBottom:S.md,
  },
  inputWrapperFocused: {
    backgroundColor:C.surface, borderRadius:R.md, borderWidth:1.5, borderColor:C.dark,
    flexDirection:'row', alignItems:'center', paddingHorizontal:S.base, height:52, marginBottom:S.md,
  },
  input: { flex:1, fontSize:T.body, fontWeight:T.bold, color:C.textPrimary, height:'100%' },
  inputLabel: { fontSize:T.sm, fontWeight:T.extrabold, color:C.textSecondary, marginBottom:S.xs, letterSpacing:0.3 },
  inputStandalone: {
    backgroundColor:C.surface, borderRadius:R.md, borderWidth:1, borderColor:C.border,
    paddingHorizontal:S.base, height:52, fontSize:T.body, fontWeight:T.bold, color:C.textPrimary, marginBottom:S.md,
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  pageTitle:    { fontSize:T.xxl,   fontWeight:T.black,    color:C.textPrimary,   letterSpacing:-0.5 },
  pageSub:      { fontSize:T.sm,    fontWeight:T.medium,   color:C.textSecondary, marginTop:S.xs, lineHeight:18 },
  sectionTitle: { fontSize:T.lg,    fontWeight:T.extrabold,color:C.textPrimary,   letterSpacing:-0.3, marginBottom:S.md, marginTop:S.sm },
  cardTitle:    { fontSize:T.body,  fontWeight:T.extrabold,color:C.textPrimary },
  cardSub:      { fontSize:T.xs,    fontWeight:T.medium,   color:C.textSecondary, marginTop:2 },
  label:        { fontSize:T.xs,    fontWeight:T.extrabold,color:C.textTertiary,  letterSpacing:0.8, textTransform:'uppercase' },
  seeAll:       { fontSize:T.base,  fontWeight:T.bold,     color:C.blue },
  sectionRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:S.md, marginTop:S.lg },
  statNum:      { fontSize:T.xxl,   fontWeight:T.black,    color:C.textPrimary },
  statLabel:    { fontSize:T.sm,    fontWeight:T.semibold,  color:C.textSecondary, marginTop:2 },
  amountDisplay:{ fontSize:T.display, fontWeight:T.black, color:C.textInverse, letterSpacing:-1 },

  // ── Badges / Chips ──────────────────────────────────────────────────────────
  badge:     { paddingHorizontal:S.sm+2, paddingVertical:S.xs, borderRadius:R.xs },
  badgeText: { fontSize:T.xs, fontWeight:T.extrabold },
  chip:      { flexDirection:'row', alignItems:'center', backgroundColor:C.surfaceAlt, paddingHorizontal:S.md, paddingVertical:S.xs+2, borderRadius:R.full, gap:S.xs+2 },
  chipText:  { fontSize:T.sm, fontWeight:T.bold, color:C.textPrimary },
  statusDot: { width:6, height:6, borderRadius:3 },
  pillBadge: { flexDirection:'row', alignItems:'center', paddingHorizontal:S.sm, paddingVertical:S.xs, borderRadius:R.xs, gap:S.xs },

  // ── Empty States ────────────────────────────────────────────────────────────
  emptyCard:  { backgroundColor:C.surface, borderRadius:R.lg, padding:S.xl, alignItems:'center', marginTop:S.base, borderWidth:1, borderColor:C.border },
  emptyTitle: { fontSize:T.md, fontWeight:T.bold, color:C.textPrimary, marginTop:S.sm },
  emptySub:   { fontSize:T.sm, color:C.textTertiary, marginTop:2, textAlign:'center', lineHeight:18 },

  // ── Headers ─────────────────────────────────────────────────────────────────
  headerBar:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:S.base, paddingVertical:S.md, backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border },
  headerIconBtn:{ width:36, height:36, borderRadius:R.sm, backgroundColor:C.surface, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border },
  // Auth brand block (Login / Register hero area)
  authBrand: {
    alignItems:'center', paddingTop:S.xxl, paddingBottom:S.xl,
  },
  authBrandIcon: {
    width:56, height:56, borderRadius:R.xl, backgroundColor:C.dark,
    alignItems:'center', justifyContent:'center', marginBottom:S.md,
  },
  authBrandTitle: {
    fontSize:T.xxl, fontWeight:T.black, color:C.textPrimary, letterSpacing:-0.5,
  },
  authBrandSub: {
    fontSize:T.xs, fontWeight:T.extrabold, color:C.green, letterSpacing:1, marginTop:2,
  },

  // ── Modal / Bottom Sheet ─────────────────────────────────────────────────────
  modalOverlay:  { flex:1, backgroundColor:'rgba(15,23,42,0.5)', justifyContent:'flex-end' },
  modalSheet:    { backgroundColor:C.surface, borderTopLeftRadius:R.card, borderTopRightRadius:R.card, padding:S.xl, paddingBottom:S.xxl },
  modalHandle:   { width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginBottom:S.lg },
  modalCenter:   { flex:1, backgroundColor:'rgba(15,23,42,0.5)', justifyContent:'center', padding:S.xl },
  modalCard:     { backgroundColor:C.surface, borderRadius:R.card, padding:S.xl, borderWidth:1, borderColor:C.border, shadowColor:C.dark, shadowOffset:{width:0,height:8}, shadowOpacity:0.15, shadowRadius:24, elevation:8 },

  // ── Misc ─────────────────────────────────────────────────────────────────────
  divider:      { height:1, backgroundColor:C.border, marginVertical:S.base },
  grid2:        { flexDirection:'row', flexWrap:'wrap', gap:S.md, marginBottom:S.base },
  row:          { flexDirection:'row', alignItems:'center', gap:S.md },
  flex1:        { flex:1 },
});

export { W as screenWidth };

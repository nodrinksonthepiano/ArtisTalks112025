/**
 * Focused checks for version-aware legacy brand bridge.
 * Run: npx tsx scripts/verify-brand-bridge.ts
 */
import {
  BRAND_FLOW_VERSION,
  isFocusedBrandFlowAnswer,
  isLegacyCombinedColorsAnswer,
  legacyBrandBridgeKeys,
  withLegacyBrandBridge,
  withResumeSatisfiedKeys,
} from '../lib/curriculum'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const v2Colors = {
  step_id: 'COLORS_PANEL',
  brand_flow_version: BRAND_FLOW_VERSION,
  primary: '#111111',
}

const legacyColors = {
  step_id: 'COLORS_PANEL',
  primary: '#111111',
  text: 'Colors set',
}

// Fresh focused colors_set must never satisfy font_set
{
  const keys = new Set(['artist_name', 'logo_uploaded', 'colors_set'])
  const bridged = withLegacyBrandBridge(keys, v2Colors)
  assert(!bridged.has('font_set'), 'v2 colors_set must not inject font_set')
  assert(
    legacyBrandBridgeKeys(keys, v2Colors).size === 0,
    'v2 colors_set legacy bridge keys must be empty'
  )
  assert(isFocusedBrandFlowAnswer(v2Colors), 'v2 marker detected')
  assert(!isLegacyCombinedColorsAnswer(v2Colors), 'v2 is not legacy')
}

// Omitting answer_data must not bridge (mid-journey safe default)
{
  const keys = new Set(['artist_name', 'logo_uploaded', 'colors_set'])
  const bridged = withLegacyBrandBridge(keys)
  assert(!bridged.has('font_set'), 'missing colorsAnswerData must not inject font_set')
  assert(
    legacyBrandBridgeKeys(keys, undefined).size === 0,
    'undefined colorsAnswerData → no bridge keys'
  )
}

// Unversioned legacy colors_set satisfies Logo + Colors + Font
{
  const keys = new Set(['artist_name', 'colors_set'])
  const bridged = withResumeSatisfiedKeys(keys, null, legacyColors)
  assert(bridged.has('logo_uploaded'), 'legacy bridge adds logo_uploaded')
  assert(bridged.has('colors_set'), 'legacy bridge keeps colors_set')
  assert(bridged.has('font_set'), 'legacy bridge adds font_set')
  assert(isLegacyCombinedColorsAnswer(legacyColors), 'unversioned is legacy')
}

console.log('verify-brand-bridge: all checks passed')

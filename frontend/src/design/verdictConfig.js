export const VERDICT_CONFIG = {
  supported: {
    glyph: '✓',
    label: 'Supported',
    code: 'supported',
    markClass: 'mark-supported'
  },
  contradicted: {
    glyph: '✕',
    label: 'Contradicted',
    code: 'contradicted',
    markClass: 'mark-contradicted'
  },
  unsupported: {
    glyph: '○',
    label: 'Insufficient evidence',
    code: 'unsupported',
    markClass: 'mark-insufficient'
  },
  ambiguous: {
    glyph: '◐',
    label: 'Ambiguous',
    code: 'ambiguous',
    markClass: 'mark-ambiguous'
  },
  logic_gap: {
    glyph: '⚑',
    label: 'LOGIC GAP',
    code: 'logic_gap',
    markClass: 'mark-logic-gap'
  },
  unsafe_advice: {
    glyph: '⚠',
    label: 'UNSAFE ADVICE',
    code: 'unsafe_advice',
    markClass: 'mark-unsafe-advice'
  }
}

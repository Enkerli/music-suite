# Apple Loops b8/b9 Encoding Analysis

## Three Encoding Schemes Discovered

### Scheme 1: Apple First-Party (b8 ∈ {1,2,3})
- **b8** = accidental type (1=flat, 2=natural, 3=sharp)  
- **b9** = pitch class (0-11)
- **w3** = typically `0x0f07`
- **Root is fully encoded**

### Scheme 2: User-Generated v1 (b8 = 0x0f = 15)
- **b8** = 0x0f (marker for scheme 2)
- **b9** = accidental preference (1=flat, 2=natural, 3=sharp)
- **w3** = typically `0x0807` or `0x0507`
- **Root must be inferred from MIDI notes**
- **Files**: Lp12-22, LpTm series

### Scheme 3: User-Generated v2 (b8 = 0xff = 255)
- **b8** = 0xff (marker for scheme 3)
- **b9** = unknown (observed: 0x03)
- **w3** = `0x0000` (differs from other schemes!)
- **Root encoding unknown** - needs investigation
- **Files**: Lp11

## Pattern Summary

| File      | w3     | b8   | b9  | Scheme | Expected Root |
|-----------|--------|------|-----|--------|---------------|
| Lp11      | 0x0000 | 0xff | 0x03| 3      | C (PC=0)      |
| Lp12      | 0x0807 | 0x0f | 0x03| 2      | C♯ (PC=1)     |
| Lp13-22   | 0x0807 | 0x0f | varies | 2   | D-B chromatic |
| LpTm*     | 0x0507 | 0x0f | varies | 2   | Unknown       |

## Key Observation

The **`w3` field** appears to indicate the metadata format version:
- `0x0000` → Scheme 3 (b8=0xff)
- `0x0507` → Scheme 2 variant A  
- `0x0807` → Scheme 2 variant B
- `0x0f07` → Scheme 1 (Apple first-party)

The low byte being `0x07` seems consistent across schemes 1 and 2, while scheme 3 uses `0x00`.

## Recommendations

1. Use `w3` as the primary scheme detector
2. Fallback to `b8` value for scheme disambiguation
3. For scheme 3 (b8=0xff), infer root from MIDI notes (similar to scheme 2)

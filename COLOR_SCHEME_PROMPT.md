# Color Scheme & CSS Styling Prompt for New Codebase

Use this prompt to instruct a Cursor AI agent to apply the same color scheme and CSS styling from the KAIA Portal frontend to your new codebase.

---

## PROMPT FOR CURSOR AI AGENT

I need you to apply the exact same color scheme, typography, and CSS styling patterns from the KAIA Portal frontend codebase to this new codebase. Here are the detailed specifications:

### **1. COLOR PALETTE**

#### **Background Colors:**
- **Dark Mode Background:** `#111111`
- **Light Mode Background:** `#f7f7f7`

#### **Primary Colors (Brand/Lime Green):**
- **Dark Mode Primary:** `#BFF009`
- **Light Mode Primary:** `#ACD808`

#### **Text Colors:**
- **Dark Mode:**
  - Primary Text: `#ffffff`
  - Secondary Text: `#AFAFAF`
- **Light Mode:**
  - Primary Text: `#040404`
  - Secondary Text: `#4C4C4C`

#### **Semantic Colors:**

**Error Colors:**
- Dark Mode: `#E85B56`
- Light Mode: `#EB807A`

**Success Colors:**
- Dark Mode: `#40AB2B`
- Light Mode: `#57CF3F`

**Secondary/Neutral Colors:**
- Dark Mode: `#667085`
- Light Mode: `#9e9e9e`

#### **Input/Form Colors:**
- **Dark Mode Input Background:** `#040404`
- **Light Mode Input Background:** `#ffffff`

#### **Toast/Notification Colors:**
- Background: `#1f5214`
- Border: `#40ab2b40` (with 40% opacity)
- Box Shadow: `rgba(87, 207, 63, 0.251)`
- Border Radius: `16px`

### **2. TYPOGRAPHY**

#### **Font Families:**
- **Primary Font:** `'Manrope', sans-serif` (used as default body font)
- **Secondary Font:** `'Red Hat Display'` or `'RedHatDisplay'` (for headings/special elements)

#### **Font Weights:**
- Regular: `400`
- SemiBold: `600`
- Bold: `700`

#### **Font Files Required:**
- Manrope-Regular.ttf (weight: 400)
- Manrope-SemiBold.ttf (weight: 600)
- Manrope-Bold.ttf (weight: 700)
- RedHatDisplay-Regular.ttf (weight: 400)
- RedHatDisplay-Bold.ttf (weight: 700)

### **3. THEME SYSTEM ARCHITECTURE**

The codebase uses a dual-theme system (dark/light) with the following structure:

#### **Theme Provider Setup:**
- Uses `styled-components` with `ThemeProvider`
- Theme mode can be 'dark' or 'light'
- Theme switching is stored in localStorage
- Global styles are applied via `createGlobalStyle` from styled-components

#### **Theme Implementation Pattern:**
```typescript
// Theme mode type
type ThemeModeType = 'dark' | 'light'

// Background colors (applied globally)
const BACKGROUND_DARK = '#111111'
const BACKGROUND_LIGHT = '#f7f7f7'

// Global style example
const GlobalStyle = createGlobalStyle<{ $themeMode: string }>`
  html, body {
    background-color: ${({ $themeMode }) =>
      $themeMode === 'light' ? BACKGROUND_LIGHT : BACKGROUND_DARK};
    -webkit-tap-highlight-color: transparent;
  }
  
  * {
    -webkit-tap-highlight-color: transparent;
  }
`
```

### **4. CSS SPECIFICATIONS**

#### **Border Radius:**
- Toast/Modal: `16px`
- Standard components: Use consistent border radius values

#### **Box Shadows:**
- Toast notifications: `0px 8px 16px rgba(87, 207, 63, 0.251)`
- Apply subtle shadows for elevation

#### **Transparency/Opacity:**
- Use rgba() for colors with opacity
- Common opacity values: 40% (0.4), 25.1% (0.251)

### **5. COMPONENT-SPECIFIC COLOR MAPPING**

When creating or updating components, map colors as follows:

**Buttons:**
- Primary buttons: Use primary color (`#BFF009` dark / `#ACD808` light)
- Text on primary buttons: Use appropriate contrast color

**Input Fields:**
- Dark mode: Background `#040404`, text `#ffffff`
- Light mode: Background `#ffffff`, text `#040404`

**Cards/Containers:**
- Use theme-appropriate background colors
- Apply subtle borders if needed

**Error States:**
- Use error colors: `#E85B56` (dark) / `#EB807A` (light)

**Success States:**
- Use success colors: `#40AB2B` (dark) / `#57CF3F` (light)

### **6. IMPLEMENTATION REQUIREMENTS**

1. **Create a theme configuration file** that exports:
   - Color constants for both dark and light modes
   - Theme type definitions
   - Helper functions for theme switching

2. **Set up styled-components ThemeProvider** with:
   - Dark theme object
   - Light theme object
   - Theme mode state management

3. **Apply global styles** including:
   - Font face declarations for Manrope and RedHatDisplay
   - Body background color based on theme
   - Tap highlight removal (`-webkit-tap-highlight-color: transparent`)

4. **Ensure all components** use theme colors from the theme object rather than hardcoded values

5. **Implement theme persistence** using localStorage to remember user's theme preference

6. **Create a theme toggle mechanism** that switches between dark and light modes

### **7. ADDITIONAL STYLING NOTES**

- Use `-webkit-tap-highlight-color: transparent` globally to remove tap highlights
- Set `overflow: hidden` on body when modals are open
- Remove spinner buttons from number inputs (`input::-webkit-outer-spin-button`, `input::-webkit-inner-spin-button`)
- Default body font should be `'Manrope', sans-serif`
- Ensure proper contrast ratios for accessibility

### **8. COLOR USAGE EXAMPLES**

**Dark Mode Theme Object:**
```typescript
{
  mode: 'dark',
  background: '#111111',
  primary: '#BFF009',
  text: {
    primary: '#ffffff',
    secondary: '#AFAFAF'
  },
  error: '#E85B56',
  success: '#40AB2B',
  secondary: '#667085',
  input: {
    background: '#040404',
    text: '#ffffff'
  }
}
```

**Light Mode Theme Object:**
```typescript
{
  mode: 'light',
  background: '#f7f7f7',
  primary: '#ACD808',
  text: {
    primary: '#040404',
    secondary: '#4C4C4C'
  },
  error: '#EB807A',
  success: '#57CF3F',
  secondary: '#9e9e9e',
  input: {
    background: '#ffffff',
    text: '#040404'
  }
}
```

### **9. VERIFICATION CHECKLIST**

After implementation, verify:
- [ ] All background colors match the specified values
- [ ] Text colors have proper contrast in both themes
- [ ] Primary brand color (lime green) is used consistently
- [ ] Error and success states use the correct colors
- [ ] Font families are correctly applied
- [ ] Theme switching works smoothly
- [ ] Theme preference persists across page reloads
- [ ] All components respect the theme mode
- [ ] Global styles are applied correctly

---

## NOTES FOR IMPLEMENTATION

- The original codebase uses `@kaiachain/kaia-design-system` package, but you should implement the color scheme directly in your codebase
- If using a different CSS-in-JS solution (not styled-components), adapt the theme provider pattern accordingly
- Ensure all hex colors are used exactly as specified
- Test both dark and light modes thoroughly
- Maintain consistency in color usage across all components

---

**End of Prompt**

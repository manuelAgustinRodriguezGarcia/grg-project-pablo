# Category showcase (landing)

## Goal

Add a decorative row of four circular category images above the brand carousel on the public landing page.

## Decisions

- Placement: between hero and brand carousel
- Items: ELECTRICIDAD, MOTOR, NEUMATICA, TRANSMISION
- Style: white circles, soft border, light section background (option A)
- Behavior: non-interactive (no links)
- Images: temporary shared placeholder `/logo-grg-negro.svg`; intended to become spare-part photos later (`object-fit: cover` + no inset padding when real photos land)
- No section title

## Implementation

- Data: `CATEGORY_SHOWCASE_ITEMS` in `landingData.ts`
- UI: `CategoryShowcase` component
- Wired in `src/app/page.tsx`

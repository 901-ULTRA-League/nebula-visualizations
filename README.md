# nebula-visualizations

Static site for ULTRAMAN card game visuals powered by the Nebula API.

## How to run

1. Open `index.html` in a browser (or use a simple server like `npx serve`).
2. The page fetches `/cards` from `https://nebula-collection-api.vercel.app/cards` on load.

## Features

- Rarity, feature, section/set, and top works breakdowns (Chart.js via CDN).
- Stacked section × rarity chart to spot set balance.
- Search and filters to focus the charts on specific cards.

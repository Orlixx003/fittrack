# 🏋️ FitTrack

A fitness tracker built with **pure vanilla JavaScript** — no frameworks, no libraries, no build step.

Calculate your daily calories and macros, log workouts, track personal records and watch your body-weight progress on a hand-drawn chart.

## ✨ Features

- **Calorie & macro calculator** — BMR via the Mifflin–St Jeor equation, TDEE from activity level, target calories for cutting / maintaining / bulking, and a protein / fat / carbs split
- **Workout log** — log exercises with sets, reps and weight; history grouped by day with total training volume
- **Personal records** — automatically tracks your best weight per exercise and shows a 🏆 notification on a new PR
- **Body-weight chart** — drawn from scratch with the **Canvas API** (HiDPI/Retina support, responsive)
- **Persistence** — all data saved in `localStorage`
- **Export / Import** — back up your data as JSON and restore it on another device
- **Responsive dark UI** — works on mobile and desktop

## 🛠 Tech stack

| Area | Used |
|------|------|
| Markup | HTML5 (semantic, forms with native validation) |
| Styles | CSS3 (custom properties, Grid, Flexbox, animations) |
| Logic | JavaScript ES2022 (modules-free, no dependencies) |
| APIs | Canvas 2D, localStorage, Blob / File API, FormData |

## 🚀 Run locally

```bash
git clone https://github.com/Orlixx003/fittrack.git
cd fittrack
# just open index.html in your browser, or:
npx serve .
```

## 📐 Formulas

```
BMR (male)   = 10 × weight + 6.25 × height − 5 × age + 5
BMR (female) = 10 × weight + 6.25 × height − 5 × age − 161
TDEE         = BMR × activity factor (1.2 – 1.9)
Target       = TDEE − 500 (cut) | TDEE (maintain) | TDEE + 300 (bulk)
Protein      = 1.8–2.2 g per kg of body weight
Fat          = 25% of target calories
Carbs        = remaining calories
```

## 📁 Project structure

```
fittrack/
├── index.html   # layout & forms
├── style.css    # dark theme, responsive layout
├── app.js       # state, calculator, workouts, chart, storage
└── README.md
```

## 🧠 What I practised

- Managing app state and syncing it with `localStorage`
- Rendering UI from data (template literals) and **event delegation**
- Preventing XSS by escaping user input before inserting HTML
- Drawing a custom line chart with the Canvas API
- Writing pure, testable functions (`calculate()`)

## 🗺 Roadmap

- [ ] Workout templates (Push / Pull / Legs)
- [ ] Charts for exercise progress (e.g. bench press over time)
- [ ] PWA — offline mode and install on phone
- [ ] Unit tests with Vitest

---

Made by Orlixx (https://github.com/Orlixx003)


# How Many Songs Do You Know?

This project aims to estimate how many songs a person "knows" — based on their real-time responses to a short quiz.

---

## 📚 Dataset

- **10,000 songs**
- Songs have:
  - **Popularity score ≥ 10** (based on Spotify’s API)
  - **Genre** inferred from artist metadata (because Spotify API doesn't have a genre field in getTrack)
- Bias: Slightly skewed toward "popular" music and global hits

---

## 🧪 Quiz Setup

Each new session pulls **100 songs** from the database:

### 🎯 70 Familiar-Tuned Songs

Random songs across all popularity tiers where:

- `Genre ∈ familiarGenres`
- `Language ∈ familiarLanguages`
- `Era ∈ familiarEras`

These songs help test **depth** — how deep your knowledge goes within the genres/languages/eras you are most exposed to.

### 🌍 30 Exploratory Songs

Songs with **popularity ≥ 63** (top 10% based on a 100k random pull), where **at least one** of the following is true:

- `Genre ∉ familiarGenres`
- `Language ∉ familiarLanguages`
- `Era ∉ familiarEras`

These songs help test **breadth** — whether you recognize major hits from beyond your usual listening.

---

## 🧠 Adaptive “Next Song” Strategy

After each response, we dynamically score all remaining songs and choose the next most **informative** one.

```js
explorationScore = (1 - familiarity) * norm(song.popularity);
depthScore       = familiarity * (1 - norm(song.popularity));

phase = responses.length / 30;

score = (1 - phase) * explorationScore + phase * depthScore;
```

- **`norm(popularity)`** maps popularity scores into the [0, 1] range.
- The quiz **starts exploratory** and gradually focuses on depth.

---

## 🔍 Familiarity Score

Each song is evaluated for how "familiar" it is to you:

```js
function getFamiliarity(song, genres, langs, eras) {
  const g = genres[song.genre]?.ratio ?? 0.5;
  const l = langs[song.language]?.ratio ?? 0.5;
  const e = eras[song.era]?.ratio ?? 0.5;
  return (g + l + e) / 3;
}
```

- Ratios are computed based on your **previous responses**
- Pre-quiz selections influence initial familiarity:
  - 0.5 for user-selected categories
  - 0.01 for unselected categories
(to be implemented)
---

## 📈 Estimating Total Songs

At the end of the quiz, your estimated known song count is calculated using a **logistic growth model**:

```
L = 30,000     // theoretical upper bound (e.g. a DJ or some other professional in the music industry)
x0, k = fitted via gradient descent
```

### A realistic upper bound:

> If someone listens to music 2 hrs/day for 30 years (no overlaps), that’s ~1.3 million minutes.
>
> With 3.5 min/song, repeated ~10x to "know" a song → ~37,500 songs.
>

A logistic curve is fitted for each genre you answered at least one question for.



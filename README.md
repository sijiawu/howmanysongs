
# How Many Songs

This project estimates how many songs you *really* know, based on your real-time self-reported responses to a short quiz.

---

## Song Bank

We start with a curated database of ~10,000 songs from Spotify. These are **not** randomly selected:

- Only include songs with popularity score ≥ 10 (This does 2 things: A. avoid complete obscurities. Popularity score is a very convenient and mysterious index assigned to each track by Spotify. For reference: my struggling artist friend from Argentina - not linked here - has songs with popularity scores ranging from 15-29). B. eliminate a known issues where a highly popular song gets included in an obscure anthology album and receives a score of 2
- Genre is inherited from the artist’s top genre (for now).
- Language is inferred from the title (for now) (to be impletemented).
- Songs are bucketed into “eras” (e.g. 80s, 90s, 2000s) (to be implemented).

---

## Quiz Setup

When a user starts the quiz, we pull a custom set of 100 songs from the DB with:

### 70 Familiar Songs
- Randomly sampled from **all popularity tiers**
- Must match user’s selected:
  - Genre(s)
  - Language(s) (to be impletemented)
  - Era(s) (to be impletemented)

### 30 Exploration Songs
- Each has popularity ≥ 63 (top ~10% in DB)
- Chosen *outside* user's familiar categories:
  - Genre, language, or era doesn't match

This combo helps test both **depth** (how far down you go in familiar areas) and **breadth** (how far you reach into other areas).

---

## Adaptive Song Selection

As the quiz goes on, we prioritize songs that give us the most new info.

Each song gets a score based on:

```js
explorationScore = (1 - familiarity) * norm(song.popularity)
depthScore = familiarity * (1 - norm(song.popularity))

phase = responses.length / 30
score = (1 - phase) * explorationScore + phase * depthScore
```

`familiarity` is calculated based on A - your initial selection and B - how often you say "YES" to songs in a given genre/language/era:

```js
familiarity = average of genreRatio, languageRatio, eraRatio
// TODO: initial values:
  - 0.5 for user-selected categories
  - 0.1 for unselected categories
```

---

## Estimation Model (the mathy part)

We fit a **logistic curve** to your responses, for each genre you've encountered at least once.

Because a logistic curve matches how recognition typically works:
- You know nearly everything at the top
- You know very little at the bottom
- Somewhere in the middle is a slope where the hit rate drops fast

It's modeled like this:

```math
hitRate(popularity) = L / (1 + exp(-k * (x - x0)))
```

- `L`: the maximum hit rate (set to 1)
- `x`: the song’s popularity
- `x0`: the popularity score at which you know 50% of the songs
- `k`: slope
- We fit `x0` and `k` using your data via gradient descent

Final estimate:

```js
    estimated_songs_in_bucket * your_hit_rate_in_bucket
```

---

## Realistic Upper Bound

Let’s say someone listens to music 2 hours a day for 30 years:

- That’s ~1,314,000 minutes of listening
- If each song averages 3.5 min and is heard ~10 times to be known → ~37,500 songs max

We currently cap the total estimate around 30k as a sanity check.

---

## Notes

- This is all experimental!
- still figuring out the best way to scale from your quiz to the universe of songs but this is where things are at for now.

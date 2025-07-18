
# How Many Songs

This project estimates how many songs you *really* know, based on your real-time self-reported responses to a short quiz.

---

## Song Bank

We start with a curated database of ~10,000 songs from Spotify. These are **not** randomly selected:

- Only include songs with popularity score ≥ 10. This does 2 things: 
    - Avoids complete obscurities. Popularity score is a very convenient and mysterious index (from 0 = most obscure to 100 = most popular) assigned to each track by Spotify. For reference: Billie Jean has a popularity score of 81 - [submithub.com/popularity-checker](https://www.submithub.com/popularity-checker?track=5ChkMS8OtdzJeqyybCc9R5) is one of many Spotify API wrappers to check this score, in case people don't want to run Postman or curl every time; at the other end of this scale, my struggling artist friend from Argentina - not linked here - has songs with popularity scores ranging from 15-29. 
    - Eliminates known issues where a highly popular song gets included in an obscure compilation album and receives a score of 1 ([example: Take On Me gets a score of 1 in this "Various Artists" album](https://www.submithub.com/popularity-checker?track=3IsHapcQ9bDkJZO1g4aWoa))

- Genre is inherited from the artist’s top genre (for now).
- Songs are bucketed into “eras” (e.g. 80s, 90s, 2000s) (to be implemented).
---

## Quiz Setup

When a user starts the quiz, we pull a pre-filtered set of 100 songs from our DB with:

### 70 "Familiarity" Songs
- Randomly sampled across **all popularity scores**
- Must match user’s selected:
  - Genre(s)
  - Era(s) (to be impletemented)

### 30 "Exploration" Songs
- Each has popularity ≥ 63 (top ~10% in DB)
- Chosen *outside* user's familiar genre/era categories:

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

where `familiarity` is a score calculated based on A - your initial selection and B - how often you say "YES" to songs in a given genre/language/era:

```js
familiarity = TODO
// Initial values are based on the likert scale:
  - 0 if "not at all"
  - 0.2 if "rarely"
  - 0.4 if "sometimes"
  - 0.6 if "very often"
  - 0.8 if "all the time"
```

---

## Estimation Model (the mathy part)

We fit a **logistic curve** to your responses for each genre you listen to.

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

```js
for (let x = 0; x <= 100; x++) {
  let p = popularityDistribution[x]; // normalized to sum to 1
  let fx = logistic(x);
  final_estimation += fx * p;
}
final_estimation *= REALISTIC_UPPER_BOUND;
```
---

## Realistic Upper Bound

Let’s say someone "actively" listens to music 2 hours a day for 30 years:

- That’s ~1,314,000 minutes of listening
- If each song averages 3.5 min and is heard ~10 times to be "known" → ~37,500 songs max

We currently cap the total estimate at 37,500.

---

## Notes

- This is all experimental!
- still figuring out the best way to scale but this is where things are at for now.

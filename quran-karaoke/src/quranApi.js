// src/quranApi.js

import { TRANSLITERATION } from "./transliterationData";

const API_BASE = "https://quranapi.pages.dev/api";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

export async function fetchSurahWithAyahs(surahNo, reciterKey = "4") {
  // Get main chapter data (Arabic, English, etc.)
  const chapter = await fetchJson(`${API_BASE}/${surahNo}.json`);

  const totalAyah = chapter.totalAyah;
  const arabicAyat = chapter.arabic1;
  const englishAyat = chapter.english;

  // Our local transliteration array for this surah
  const translitAyat = TRANSLITERATION[surahNo] || [];

  // Build per-ayah objects with audio + transliteration
  const ayahs = await Promise.all(
    Array.from({ length: totalAyah }, async (_, i) => {
      const ayahNo = i + 1;

      // per-ayah audio
      const audioData = await fetchJson(
        `${API_BASE}/audio/${surahNo}/${ayahNo}.json`
      );
      const reciterEntry = audioData[reciterKey];
      const audioUrl = reciterEntry.originalUrl || reciterEntry.url;

      return {
        number: ayahNo,
        text_ar: arabicAyat[i],
        english: englishAyat?.[i],
        transliteration: translitAyat[i] || "",
        audioUrl
      };
    })
  );

  // Full-surah audio for learning mode
  const chapterAudio = await fetchJson(`${API_BASE}/audio/${surahNo}.json`);
  const chapterReciterEntry = chapterAudio[reciterKey];
  const fullAudioUrl =
    chapterReciterEntry.originalUrl || chapterReciterEntry.url;

  return {
    surahNumber: chapter.surahNo,
    name: chapter.surahName,
    arabicName: chapter.surahNameArabic,
    ayahs,
    fullAudioUrl
  };
}

export async function fetchSelectedSurahs(reciterKey = "4") {
  // Al-Faatiha + Ad-Duhaa → An-Naas
  const surahNumbers = [
    1, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
    109, 110, 111, 112, 113, 114
  ];

  return Promise.all(
    surahNumbers.map((n) => fetchSurahWithAyahs(n, reciterKey))
  );
}
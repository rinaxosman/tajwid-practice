// src/QuranKaraoke.jsx

import { useEffect, useRef, useState } from "react";
import { fetchSelectedSurahs } from "./quranApi";

function ModeInfoIcon() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Info icon */}
      <span
        onClick={() => setOpen(true)}
        style={{
          marginLeft: 8,
          fontSize: 13,
          cursor: "pointer",
          opacity: 0.7,
          border: "1px solid #444",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          userSelect: "none",
        }}
      >
        i
      </span>

      {/* Popup Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              padding: "20px 22px",
              borderRadius: 10,
              border: "1px solid #333",
              width: "85%",
              maxWidth: 420,
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
            }}
          >
            <h3 style={{ margin: "0 0 10px", textAlign: "center" }}>
              Mode Guide
            </h3>

            <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
              <strong>Learning Mode</strong> – Plays the full surah and
              automatically highlights each ayah as it’s recited.
            </p>

            <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
              <strong>Practice Mode</strong> – Plays one ayah at a time. Then
              it&apos;s your turn to recite before moving on.
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "8px 0",
                borderRadius: 6,
                background: "#2f3cff",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function QuranKaraoke() {
  const [surahs, setSurahs] = useState([]);
  const [selectedSurahIndex, setSelectedSurahIndex] = useState(0);
  const [mode, setMode] = useState("learning"); // "learning" | "practice"
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reciter selection, default = Yasser (4)
  const [reciter, setReciter] = useState("4");

  // For learning mode highlighting – per-ayah durations
  const [ayahDurations, setAyahDurations] = useState([]);

  // Hover state for ayah list
  const [hoveredAyahIndex, setHoveredAyahIndex] = useState(null);

  // Surah picker open/close
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);

  const audioRef = useRef(null);

  // refs for each ayah to auto-scroll into view
  const ayahRefs = useRef([]);

  const selectedSurah = surahs[selectedSurahIndex] || null;
  const ayahs = selectedSurah?.ayahs || [];

  const reciterOptionStyle = {
    backgroundColor: "#111",
    color: "#fff",
    padding: "10px",
  };

  // Load surahs initially + whenever reciter changes
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchSelectedSurahs(reciter);
        setSurahs(data);
        setSelectedSurahIndex(0);
      } catch (e) {
        setError(e.message || "Failed to load surahs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reciter]);

  // Reset playback when surah or mode changes
  useEffect(() => {
    resetPlayback();
  }, [selectedSurahIndex, mode]);

  function resetPlayback() {
    setCurrentAyahIndex(0);
    setIsUserTurn(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  }

  // Preload per-ayah durations (for learning mode highlighting)
  useEffect(() => {
    if (!selectedSurah || ayahs.length === 0) {
      setAyahDurations([]);
      return;
    }

    let cancelled = false;

    async function loadDurations() {
      try {
        const durations = await Promise.all(
          ayahs.map(
            (ayah) =>
              new Promise((resolve) => {
                const audio = new Audio();
                audio.src = ayah.audioUrl;
                audio.addEventListener("loadedmetadata", () => {
                  resolve(audio.duration || 0);
                });
                audio.addEventListener("error", () => resolve(0));
              })
          )
        );
        if (!cancelled) {
          setAyahDurations(durations);
        }
      } catch {
        if (!cancelled) {
          setAyahDurations([]);
        }
      }
    }

    loadDurations();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurahIndex, surahs.length]);

  // Auto-scroll the current ayah into view
  useEffect(() => {
    const el = ayahRefs.current[currentAyahIndex];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentAyahIndex]);

  // Practice mode: play one ayah (per-ayah MP3)
  function playAyah(index) {
    if (!selectedSurah) return;

    const ayah = ayahs[index];
    const audio = audioRef.current;
    if (!ayah || !audio) return;

    setCurrentAyahIndex(index);
    setIsUserTurn(false);

    audio.src = ayah.audioUrl;
    audio.play().catch(() => {});
  }

  function handleAudioEnded() {
    if (!selectedSurah) return;

    if (mode === "learning") {
      // Full surah finished – nothing else
      return;
    }

    if (mode === "practice") {
      setIsUserTurn(true);
    }
  }

  // While full audio plays, map currentTime → current ayah
  function handleTimeUpdate() {
    if (mode !== "learning") return;
    if (!audioRef.current || ayahDurations.length === 0) return;

    const t = audioRef.current.currentTime;
    let cumulative = 0;

    for (let i = 0; i < ayahDurations.length; i++) {
      cumulative += ayahDurations[i];
      if (t <= cumulative) {
        if (currentAyahIndex !== i) {
          setCurrentAyahIndex(i);
        }
        break;
      }
    }
  }

  // Learning mode: use full-surah MP3
  function startLearning() {
    if (!selectedSurah) return;
    const audio = audioRef.current;
    if (!audio) return;

    setIsUserTurn(false);
    setCurrentAyahIndex(0);

    audio.src = selectedSurah.fullAudioUrl;
    audio.play().catch(() => {});
  }

  // Practice mode: start from ayah 0
  function startPractice() {
    if (!selectedSurah) return;
    playAyah(0);
  }

  function nextAyahPractice() {
    if (!selectedSurah) return;
    setIsUserTurn(false);

    setCurrentAyahIndex((prev) => {
      const next = prev + 1;
      if (next < ayahs.length) {
        setTimeout(() => playAyah(next), 0);
        return next;
      }
      return prev;
    });
  }

  function pauseAudio() {
    if (audioRef.current) audioRef.current.pause();
  }

  // Click an ayah to start practice from there
  function handleAyahClick(index) {
    if (!selectedSurah) return;
    setMode("practice");
    playAyah(index);
  }

  // previous / next surah buttons
  function goToPreviousSurah() {
    setSurahPickerOpen(false);
    setSelectedSurahIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }

  function goToNextSurah() {
    setSurahPickerOpen(false);
    setSelectedSurahIndex((prev) =>
      prev < surahs.length - 1 ? prev + 1 : prev
    );
  }

  // choose surah from picker
  function handlePickSurah(index) {
    setSelectedSurahIndex(index);
    setSurahPickerOpen(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <p>Loading surahs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "red" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!selectedSurah) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <p>No surah loaded.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* HEADER */}
      <h1 style={{ textAlign: "center", marginBottom: 4, fontSize: "2.7rem" }}>
        Tajwīd Practice
      </h1>
      <p
        style={{
          textAlign: "center",
          marginTop: 0,
          fontSize: 14,
          opacity: 0.8,
        }}
      >
        Learn, recite, and understand the Qur’an ayah by ayah.
      </p>

      {/* RECITER ROW */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
        }}
      >
        <span style={{ opacity: 0.85 }}>Reciter:</span>
        <select
          value={reciter}
          onChange={(e) => setReciter(e.target.value)}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            borderRadius: 9999,
            border: "1px solid #3b3b3b",
            background: "#111",
            color: "#fff",
            outline: "none",
            cursor: "pointer",
            boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(135deg, #fff 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 14px) 50%, calc(100% - 9px) 50%",
            backgroundSize: "6px 6px, 6px 6px",
            backgroundRepeat: "no-repeat",
            paddingRight: 28,
          }}
        >
          <option value="1" style={reciterOptionStyle}>
            Mishary Al-Afasy
          </option>
          <option value="2" style={reciterOptionStyle}>
            Abu Bakr Al Shatri
          </option>
          <option value="3" style={reciterOptionStyle}>
            Nasser Al Qatami
          </option>
          <option value="4" style={reciterOptionStyle}>
            Yasser Al-Dosari
          </option>
          <option value="5" style={reciterOptionStyle}>
            Hani Ar Rifai
          </option>
        </select>
      </div>

      {/* SURAH NAV BAR */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={goToPreviousSurah}
          disabled={selectedSurahIndex === 0}
          style={{ minWidth: 110 }}
        >
          ← Previous
        </button>

        <div
          style={{
            flex: 1,
            textAlign: "center",
            cursor: "pointer",
            padding: "4px 0",
          }}
          onClick={() => setSurahPickerOpen((open) => !open)}
        >
          <div style={{ fontSize: "1.9rem" }}>{selectedSurah.arabicName}</div>
          <div style={{ fontSize: "0.95rem", opacity: 0.8 }}>
            Surah {selectedSurah.surahNumber}: {selectedSurah.name}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              opacity: 0.6,
              color: "#5574e4ff",
            }}
          >
            Click to choose a surah
          </div>
        </div>

        <button
          onClick={goToNextSurah}
          disabled={selectedSurahIndex === surahs.length - 1}
          style={{ minWidth: 110 }}
        >
          Next →
        </button>
      </div>

      {/* SURAH PICKER DROPDOWN */}
      {surahPickerOpen && (
        <div
          style={{
            marginTop: 10,
            background: "#151515",
            borderRadius: 10,
            border: "1px solid #333",
            maxHeight: 260,
            overflowY: "auto",
            padding: 8,
          }}
        >
          {surahs.map((s, idx) => (
            <button
              key={s.surahNumber}
              onClick={() => handlePickSurah(idx)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background:
                  idx === selectedSurahIndex ? "#24315f" : "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
              }}
            >
              <span>
                {s.surahNumber}. {s.name}
              </span>
              <span style={{ fontSize: "1.1rem", opacity: 0.9 }}>
                {s.arabicName}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* CONTROLS CARD */}
      <div
        style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 10,
          background: "#151515",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("learning")}
            disabled={mode === "learning"}
          >
            Learning Mode
          </button>
          <button
            onClick={() => setMode("practice")}
            disabled={mode === "practice"}
          >
            Practice Mode
          </button>

          <ModeInfoIcon />
        </div>

        {/* Play controls (depend on mode) */}
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "learning" && (
            <>
              <button onClick={startLearning}>Play Surah</button>
              <button onClick={pauseAudio}>Pause</button>
            </>
          )}

          {mode === "practice" && (
            <>
              <button onClick={startPractice}>Start Practice</button>
              {isUserTurn && (
                <button onClick={nextAyahPractice}>Next Ayah</button>
              )}
            </>
          )}
        </div>

        {mode === "practice" && isUserTurn && (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
            Your turn: recite this ayah, then press &quot;Next Ayah&quot;.
          </p>
        )}
      </div>

      {/* AUDIO ELEMENT */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        style={{ display: "none" }}
      />

      {/* AYAH PANEL */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 10,
          background: "#181818",
          maxHeight: 420,
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        {ayahs.map((ayah, idx) => {
          const highlightInLearning =
            mode === "learning" && idx === currentAyahIndex;
          const highlightInPractice =
            mode === "practice" && idx === currentAyahIndex;
          const isCurrent = highlightInLearning || highlightInPractice;

          return (
            <div
              key={ayah.number}
              ref={(el) => (ayahRefs.current[idx] = el)}
              onClick={() => handleAyahClick(idx)}
              onMouseEnter={() => setHoveredAyahIndex(idx)}
              onMouseLeave={() => setHoveredAyahIndex(null)}
              style={{
                padding: "8px 10px",
                marginBottom: 6,
                borderRadius: 8,
                cursor: "pointer",
                background: isCurrent
                  ? "#24315f"
                  : hoveredAyahIndex === idx
                  ? "#202637"
                  : "transparent",
                border: isCurrent
                  ? "1px solid #3f5bff"
                  : hoveredAyahIndex === idx
                  ? "1px solid #333a55"
                  : "1px solid transparent",
                textAlign: "right",
                transition:
                  "background 0.15s ease, border-color 0.15s ease, transform 0.1s ease",
              }}
            >
              {/* Arabic */}
              <div style={{ fontSize: "1.4rem" }}>{ayah.text_ar}</div>

              {/* Transliteration */}
              {ayah.transliteration && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    opacity: 0.9,
                    textAlign: "left",
                    marginTop: 4,
                    fontStyle: "italic",
                  }}
                >
                  {ayah.transliteration}
                </div>
              )}

              {/* English translation */}
              {ayah.english && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.8,
                    textAlign: "left",
                    marginTop: 4,
                  }}
                >
                  {ayah.number}. {ayah.english}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

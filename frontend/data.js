const WG_DATA = {
    startDate: "2026-04-13",
    flatmates: [], // wird vom Server geladen (/api/flatmates), im Admin-Bereich verwaltet
    roles: [
        {
            id: "k1",
            short: "Küche 1",
            title: "Küche (Team 1)",
            description: "Arbeitsflächen abwischen, Herd & Spüle reinigen, Müll rausbringen, Boden saugen & wischen. Team-Abstimmung: Wer macht was?",
        },
        {
            id: "k2",
            short: "Küche 2",
            title: "Küche (Team 2)",
            description: "Arbeitsflächen abwischen, Herd & Spüle reinigen, Müll rausbringen, Boden saugen & wischen. Team-Abstimmung: Wer macht was?",
        },
        {
            id: "gb",
            short: "Großes Bad",
            title: "Großes Bad",
            description: "Dusche/Badewanne schrubben, Waschbecken & Spiegel reinigen, Toilette gründlich putzen, Boden wischen.",
        },
        {
            id: "kb",
            short: "Kl. Bad & Flur",
            title: "Kleines Bad & Flur",
            description: "Gäste-WC reinigen (Waschbecken, Spiegel, Toilette). Gesamten Flur saugen und bei Bedarf wischen.",
        },
        {
            id: "p",
            short: "Pause",
            title: "Pause (Frei)",
            description: "Keine festen Putzaufgaben. Ggf. Vorräte (Klopapier, Spüli, Tabs) prüfen und Bescheid geben, wenn etwas fehlt.",
        }
    ]
};

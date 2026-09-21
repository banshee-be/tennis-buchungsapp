export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string;
  memberNumber?: string | null;
  birthDate?: Date | string | null;
};

function normalized(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function duplicateScore(left: DuplicateCandidate, right: DuplicateCandidate) {
  if (left.id === right.id) return { score: 0, reasons: [] as string[] };
  let score = 0;
  const reasons: string[] = [];
  if (normalized(left.email) && normalized(left.email) === normalized(right.email)) {
    score += 100;
    reasons.push("gleiche E-Mail-Adresse");
  }
  if (normalized(left.memberNumber) && normalized(left.memberNumber) === normalized(right.memberNumber)) {
    score += 100;
    reasons.push("gleiche Mitgliedsnummer");
  }
  if (normalized(left.name) && normalized(left.name) === normalized(right.name)) {
    score += 35;
    reasons.push("gleicher Name");
  }
  if (left.birthDate && right.birthDate && new Date(left.birthDate).toISOString().slice(0, 10) === new Date(right.birthDate).toISOString().slice(0, 10)) {
    score += 45;
    reasons.push("gleiches Geburtsdatum");
  }
  return { score, reasons };
}

export function findDuplicatePairs(users: DuplicateCandidate[], minimumScore = 70) {
  const pairs: Array<{ left: DuplicateCandidate; right: DuplicateCandidate; score: number; reasons: string[] }> = [];
  for (let leftIndex = 0; leftIndex < users.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < users.length; rightIndex += 1) {
      const result = duplicateScore(users[leftIndex], users[rightIndex]);
      if (result.score >= minimumScore) pairs.push({ left: users[leftIndex], right: users[rightIndex], ...result });
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}

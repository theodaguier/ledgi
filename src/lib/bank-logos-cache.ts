const logoCache: Record<string, string> = {};
let fetchPromise: Promise<Record<string, string>> | null = null;

export async function fetchBankLogos(ids: string[]): Promise<Record<string, string>> {
  const uncachedIds = ids.filter((id) => !logoCache[id]);
  if (uncachedIds.length > 0 && !fetchPromise) {
    fetchPromise = fetch(`/api/bank-logos?ids=${uncachedIds.join(",")}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch bank logos");
        return res.json() as Promise<{ logos: Record<string, string> }>;
      })
      .then(({ logos }) => {
        Object.assign(logoCache, logos);
        fetchPromise = null;
        return { ...logoCache };
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }
  if (fetchPromise) {
    await fetchPromise;
  }
  return { ...logoCache };
}

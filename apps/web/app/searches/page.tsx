import Link from "next/link";
import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth/nextauth";
import { getSavedSearchesForUser } from "@/lib/saved-searches";

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "Never";
  }
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default async function SavedSearchesPage() {
  const session = await auth();
  const id = session?.user?.id;

  if (!session?.user || !id) {
    return (
      <section>
        <h1>Saved searches</h1>
        <p>You must be signed in to view your saved searches.</p>
      </section>
    );
  }

  let userId: ObjectId;
  try {
    userId = new ObjectId(id);
  } catch {
    return (
      <section>
        <h1>Saved searches</h1>
        <p>Unable to resolve your account identifier.</p>
      </section>
    );
  }

  const savedSearches = await getSavedSearchesForUser(userId);

  return (
    <section
      className="saved-searches-page"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      <header
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h1>Saved searches</h1>
        <Link
          className="create-link"
          href="/searches/new"
          style={{
            background: "#0969da",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "6px"
          }}
        >
          Create new search
        </Link>
      </header>
      {savedSearches.length === 0 ? (
        <p>You haven&apos;t saved any searches yet.</p>
      ) : (
        <ul
          className="search-list"
          style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}
        >
          {savedSearches.map((search) => (
            <li
              key={search._id?.toHexString()}
              className="search-card"
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "8px",
                padding: "1rem",
                display: "grid",
                gap: "0.5rem"
              }}
            >
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <h2>
                  <Link href={`/searches/${search._id?.toHexString()}`}>{search.name}</Link>
                </h2>
                {search.description ? <p>{search.description}</p> : null}
              </div>
              <dl style={{ display: "flex", gap: "2rem" }}>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <dt style={{ fontWeight: 600 }}>Last run</dt>
                  <dd style={{ margin: 0 }}>{formatDate(search.lastRunAt)}</dd>
                </div>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <dt style={{ fontWeight: 600 }}>Notifications</dt>
                  <dd style={{ margin: 0 }}>
                    {search.notifications.email?.enabled ? "Email" : null}
                    {search.notifications.webhook?.enabled
                      ? `${search.notifications.email?.enabled ? " & " : ""}Webhook`
                      : null}
                    {!search.notifications.email?.enabled && !search.notifications.webhook?.enabled
                      ? "Disabled"
                      : null}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


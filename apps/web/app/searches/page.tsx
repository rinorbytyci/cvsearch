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
    <section className="saved-searches-page">
      <header>
        <h1>Saved searches</h1>
        <Link className="create-link" href="/searches/new">
          Create new search
        </Link>
      </header>
      {savedSearches.length === 0 ? (
        <p>You haven&apos;t saved any searches yet.</p>
      ) : (
        <ul className="search-list">
          {savedSearches.map((search) => (
            <li key={search._id?.toHexString()} className="search-card">
              <div>
                <h2>
                  <Link href={`/searches/${search._id?.toHexString()}`}>{search.name}</Link>
                </h2>
                {search.description ? <p>{search.description}</p> : null}
              </div>
              <dl>
                <div>
                  <dt>Last run</dt>
                  <dd>{formatDate(search.lastRunAt)}</dd>
                </div>
                <div>
                  <dt>Notifications</dt>
                  <dd>
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

      <style jsx>{`
        .saved-searches-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .create-link {
          background: #0969da;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }

        .search-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 1rem;
        }

        .search-card {
          border: 1px solid #d0d7de;
          border-radius: 8px;
          padding: 1rem;
          display: grid;
          gap: 0.5rem;
        }

        dl {
          display: flex;
          gap: 2rem;
        }

        dt {
          font-weight: 600;
        }

        dd {
          margin: 0;
        }
      `}</style>
    </section>
  );
}


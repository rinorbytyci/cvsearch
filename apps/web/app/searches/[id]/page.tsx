import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth/nextauth";
import {
  industriesCollection,
  skillsCollection,
  technologiesCollection
} from "@/lib/db/collections";
import { getSavedSearchById } from "@/lib/saved-searches";
import { SavedSearchBuilder } from "@/components/searches/SavedSearchBuilder";
import type { TaxonomyOption } from "@/components/cv/CvFilterPanel";

async function loadTaxonomy(): Promise<{
  skills: TaxonomyOption[];
  industries: TaxonomyOption[];
  technologies: TaxonomyOption[];
}> {
  const [skillsCol, industriesCol, technologiesCol] = await Promise.all([
    skillsCollection(),
    industriesCollection(),
    technologiesCollection()
  ]);

  const [skills, industries, technologies] = await Promise.all([
    skillsCol.find().sort({ name: 1 }).limit(50).toArray(),
    industriesCol.find().sort({ name: 1 }).limit(50).toArray(),
    technologiesCol.find().sort({ name: 1 }).limit(50).toArray()
  ]);

  const mapDoc = (doc: { _id?: ObjectId; name: string; slug: string; description?: string | null }) => ({
    id: doc._id?.toHexString() ?? doc.slug,
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? null
  });

  return {
    skills: skills.map(mapDoc),
    industries: industries.map(mapDoc),
    technologies: technologies.map(mapDoc)
  };
}

interface SavedSearchPageProps {
  params: { id?: string };
}

export default async function SavedSearchDetailPage({ params }: SavedSearchPageProps) {
  const session = await auth();
  const idParam = params.id;

  if (!session?.user || !session.user.id) {
    return (
      <section>
        <h1>Saved search</h1>
        <p>You must sign in to manage saved searches.</p>
      </section>
    );
  }

  if (!idParam) {
    return (
      <section>
        <h1>Saved search</h1>
        <p>Missing saved search identifier.</p>
      </section>
    );
  }

  let userId: ObjectId;
  let searchId: ObjectId;
  try {
    userId = new ObjectId(session.user.id);
    searchId = new ObjectId(idParam);
  } catch {
    return (
      <section>
        <h1>Saved search</h1>
        <p>Invalid saved search identifier.</p>
      </section>
    );
  }

  const [taxonomy, savedSearch] = await Promise.all([
    loadTaxonomy(),
    getSavedSearchById(userId, searchId)
  ]);

  if (!savedSearch) {
    return (
      <section>
        <h1>Saved search</h1>
        <p>Saved search not found.</p>
      </section>
    );
  }

  return (
    <section className="edit-saved-search">
      <h1>Edit saved search</h1>
      <SavedSearchBuilder
        taxonomy={taxonomy}
        savedSearchId={savedSearch._id?.toHexString() ?? null}
        initialFilters={savedSearch.filters}
        initialName={savedSearch.name}
        initialDescription={savedSearch.description ?? ""}
        initialNotifications={{
          emailEnabled: savedSearch.notifications.email?.enabled ?? false,
          emailRecipients: savedSearch.notifications.email?.recipients ?? undefined,
          webhookEnabled: savedSearch.notifications.webhook?.enabled ?? false,
          webhookUrl: savedSearch.notifications.webhook?.url ?? null,
          webhookSecret: savedSearch.notifications.webhook?.secret ?? null
        }}
      />
    </section>
  );
}


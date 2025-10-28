import { ObjectId } from "mongodb";

import { auth } from "@/lib/auth/nextauth";
import {
  industriesCollection,
  skillsCollection,
  technologiesCollection
} from "@/lib/db/collections";
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

export default async function NewSavedSearchPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <section>
        <h1>Create saved search</h1>
        <p>You must sign in to create saved searches.</p>
      </section>
    );
  }

  const taxonomy = await loadTaxonomy();

  return (
    <section className="new-saved-search">
      <h1>Create saved search</h1>
      <SavedSearchBuilder taxonomy={taxonomy} />
    </section>
  );
}


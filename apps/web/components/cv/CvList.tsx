"use client";

import { useMemo } from "react";

export interface CvListSkill {
  name: string;
  level?: string | null;
  years?: number | null;
}

export interface CvListConsultant {
  name: string;
  title?: string | null;
  location?: string | null;
  seniority?: string | null;
  languages?: string[];
}

export interface CvListAvailability {
  status: string;
  availableFrom?: string | null;
  notes?: string | null;
}

export interface CvListItemProps {
  id: string;
  consultant: CvListConsultant;
  availability: CvListAvailability;
  skills: CvListSkill[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CvListProps {
  items: CvListItemProps[];
  isLoading?: boolean;
  error?: string | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatAvailabilityStatus(status: string) {
  switch (status) {
    case "available":
      return "Available";
    case "soon":
      return "Available soon";
    case "unavailable":
      return "Not available";
    default:
      return status;
  }
}

export function CvList({ items, isLoading = false, error = null }: CvListProps) {
  const content = useMemo(() => {
    if (isLoading) {
      return <p>Loading CVs...</p>;
    }

    if (error) {
      return <p className="error">{error}</p>;
    }

    if (!items.length) {
      return <p>No CVs matched the current filters.</p>;
    }

    return (
      <ul className="cv-results">
        {items.map((item) => (
          <li key={item.id} className="cv-card">
            <header>
              <h3>{item.consultant.name}</h3>
              {item.consultant.title ? <p className="consultant-title">{item.consultant.title}</p> : null}
            </header>
            <div className="consultant-meta">
              {item.consultant.seniority ? <span>{item.consultant.seniority}</span> : null}
              {item.consultant.location ? <span>{item.consultant.location}</span> : null}
              {item.consultant.languages?.length ? (
                <span>Languages: {item.consultant.languages.join(", ")}</span>
              ) : null}
            </div>
            <div className="availability">
              <strong>{formatAvailabilityStatus(item.availability.status)}</strong>
              {item.availability.availableFrom ? (
                <span>from {formatDate(item.availability.availableFrom)}</span>
              ) : null}
              {item.availability.notes ? <span>{item.availability.notes}</span> : null}
            </div>
            <div className="skills">
              <h4>Skills</h4>
              <ul>
                {item.skills.slice(0, 6).map((skill) => (
                  <li key={`${item.id}-${skill.name}`}>
                    <span>{skill.name}</span>
                    {skill.level ? <span className="skill-meta">({skill.level})</span> : null}
                    {typeof skill.years === "number" ? (
                      <span className="skill-meta"> – {skill.years} yrs</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            {item.tags?.length ? (
              <div className="tags">
                {item.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <footer>
              <small>Updated {formatDate(item.updatedAt)}</small>
            </footer>
          </li>
        ))}
      </ul>
    );
  }, [items, isLoading, error]);

  return (
    <section className="cv-list">
      <h2>Results</h2>
      {content}
      <style jsx>{`
        .cv-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .cv-results {
          list-style: none;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          padding: 0;
          margin: 0;
        }

        .cv-card {
          border: 1px solid #d0d7de;
          border-radius: 8px;
          padding: 1rem;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-height: 220px;
        }

        .consultant-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #57606a;
        }

        .availability {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          font-size: 0.9rem;
        }

        .skills ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .skills li {
          background: #f6f8fa;
          border-radius: 16px;
          padding: 0.25rem 0.75rem;
          font-size: 0.85rem;
        }

        .skill-meta {
          color: #57606a;
          margin-left: 0.25rem;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .tag {
          background: #ddf4ff;
          color: #0969da;
          border-radius: 12px;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .consultant-title {
          margin: 0;
          color: #57606a;
          font-size: 0.95rem;
        }

        .error {
          color: #b31d28;
        }
      `}</style>
    </section>
  );
}


"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEventHandler,
  type DragEventHandler,
  type FormEventHandler,
  type KeyboardEventHandler
} from "react";

type UploadStatus = "idle" | "uploading" | "success" | "duplicate" | "error";

type UploadResultStatus = "stored" | "duplicate" | "error";

type UploadResult = {
  status: UploadResultStatus;
  versionId?: string;
  message?: string;
};

interface SkillInput {
  id: string;
  name: string;
  level: string;
  years: string;
}

interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string | null;
  versionId?: string;
}

interface MetadataPayload {
  cvId?: string;
  consultant: {
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    location?: string;
  };
  skills: Array<{
    name: string;
    level?: string;
    years?: number;
  }>;
  availability: {
    status: "available" | "unavailable" | "soon" | "unknown";
    availableFrom?: string;
    notes?: string;
  };
  tags: string[];
  notes?: string;
  uploadedBy?: string;
}

const AVAILABILITY_OPTIONS: Array<MetadataPayload["availability"]["status"]> = [
  "available",
  "soon",
  "unavailable",
  "unknown"
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function createSkillInput(): SkillInput {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return {
    id: randomId,
    name: "",
    level: "",
    years: ""
  };
}

function makeFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

async function uploadFile(
  file: File,
  metadata: MetadataPayload,
  onProgress: (progress: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("files", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cvs");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = event.total > 0 ? event.loaded / event.total : 0;
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      const { status } = xhr;
      let response: any = null;

      try {
        response = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (error) {
        // ignore parse errors; we'll fall back to generic messaging below
      }

      if (status >= 200 && status < 300) {
        const result = response?.results?.[0];
        resolve({
          status: (result?.status as UploadResultStatus) ?? "stored",
          versionId: result?.versionId ?? response?.results?.[0]?.versionId ?? response?.versionId,
          message: result?.message
        });
        return;
      }

      if (status === 409) {
        const result = response?.results?.[0];
        resolve({
          status: (result?.status as UploadResultStatus) ?? "duplicate",
          message: result?.message ?? response?.error
        });
        return;
      }

      const errorMessage = response?.error ?? `Upload failed with status ${status}`;
      reject(new Error(errorMessage));
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading CV"));
    };

    xhr.send(formData);
  });
}

function buildMetadataPayload(options: {
  cvId?: string;
  consultant: MetadataPayload["consultant"];
  skills: SkillInput[];
  availabilityStatus: MetadataPayload["availability"]["status"];
  availabilityDate: string;
  availabilityNotes: string;
  tags: string[];
  notes: string;
  uploadedBy: string;
}): MetadataPayload {
  const skills = options.skills
    .map((skill) => ({
      name: skill.name.trim(),
      level: skill.level.trim() || undefined,
      years: skill.years.trim() ? Number(skill.years.trim()) : undefined
    }))
    .filter((skill) => skill.name.length > 0);

  const availability: MetadataPayload["availability"] = {
    status: options.availabilityStatus
  };

  if (options.availabilityDate) {
    availability.availableFrom = new Date(options.availabilityDate).toISOString();
  }

  if (options.availabilityNotes.trim()) {
    availability.notes = options.availabilityNotes.trim();
  }

  const payload: MetadataPayload = {
    cvId: options.cvId?.trim() || undefined,
    consultant: {
      name: options.consultant.name.trim(),
      email: options.consultant.email?.trim() || undefined,
      phone: options.consultant.phone?.trim() || undefined,
      title: options.consultant.title?.trim() || undefined,
      location: options.consultant.location?.trim() || undefined
    },
    skills,
    availability,
    tags: options.tags.map((tag) => tag.trim()).filter(Boolean),
    notes: options.notes.trim() || undefined,
    uploadedBy: options.uploadedBy.trim() || undefined
  };

  return payload;
}

export function CvUploadForm() {
  const [consultantName, setConsultantName] = useState("");
  const [consultantEmail, setConsultantEmail] = useState("");
  const [consultantPhone, setConsultantPhone] = useState("");
  const [consultantTitle, setConsultantTitle] = useState("");
  const [consultantLocation, setConsultantLocation] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [existingCvId, setExistingCvId] = useState("");

  const [skills, setSkills] = useState<SkillInput[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<MetadataPayload["availability"]["status"]>("unknown");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [availabilityNotes, setAvailabilityNotes] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");

  const isSubmitDisabled = useMemo(() => {
    return isUploading || queuedFiles.length === 0 || consultantName.trim().length === 0;
  }, [consultantName, isUploading, queuedFiles.length]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);

    setQueuedFiles((prev) => {
      const existingIds = new Set(prev.map((queued) => queued.id));
      const nextFiles: QueuedFile[] = filesArray
        .filter((file) => file.size > 0)
        .filter((file) => !existingIds.has(makeFileId(file)))
        .map((file) => ({
          id: makeFileId(file),
          file,
          progress: 0,
          status: "idle",
          error: null
        }));

      return [...prev, ...nextFiles];
    });
  }, []);

  const handleFileInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.target.files) {
        addFiles(event.target.files);
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback<DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      if (event.dataTransfer?.files) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback<DragEventHandler<HTMLDivElement>>((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueuedFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const updateFile = useCallback((id: string, updater: (file: QueuedFile) => QueuedFile) => {
    setQueuedFiles((prev) => prev.map((file) => (file.id === id ? updater(file) : file)));
  }, []);

  const resetForm = useCallback(() => {
    setQueuedFiles([]);
    setIsUploading(false);
    setStatusMessage(null);
    setStatusType("info");
  }, []);

  const handleAddSkill = useCallback(() => {
    setSkills((prev) => [...prev, createSkillInput()]);
  }, []);

  const handleSkillChange = useCallback((id: string, field: keyof SkillInput, value: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === id
          ? {
              ...skill,
              [field]: value
            }
          : skill
      )
    );
  }, []);

  const handleRemoveSkill = useCallback((id: string) => {
    setSkills((prev) => prev.filter((skill) => skill.id !== id));
  }, []);

  const handleTagKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (!tagInput.trim()) {
        return;
      }

      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        const tag = tagInput.trim();
        if (!tags.includes(tag)) {
          setTags((prev) => [...prev, tag]);
        }
        setTagInput("");
      }
    },
    [tagInput, tags]
  );

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((value) => value !== tag));
  }, []);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
      event.preventDefault();
      if (isSubmitDisabled) {
        return;
      }

      setIsUploading(true);
      setStatusMessage(null);

      const metadata = buildMetadataPayload({
        cvId: existingCvId,
        consultant: {
          name: consultantName,
          email: consultantEmail,
          phone: consultantPhone,
          title: consultantTitle,
          location: consultantLocation
        },
        skills,
        availabilityStatus,
        availabilityDate,
        availabilityNotes,
        tags,
        notes,
        uploadedBy
      });

      const results: Array<{ id: string; result: UploadResult }> = [];

      for (const file of queuedFiles) {
        updateFile(file.id, (queued) => ({
          ...queued,
          status: "uploading",
          progress: 0,
          error: null
        }));

        try {
          const result = await uploadFile(file.file, metadata, (progress) => {
            updateFile(file.id, (queued) => ({
              ...queued,
              progress
            }));
          });

          const status: UploadStatus =
            result.status === "duplicate"
              ? "duplicate"
              : result.status === "stored"
              ? "success"
              : "error";

          updateFile(file.id, (queued) => ({
            ...queued,
            status,
            progress: 1,
            versionId: result.versionId ?? queued.versionId,
            error: status === "error" ? result.message ?? "Upload failed" : null
          }));

          results.push({ id: file.id, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          updateFile(file.id, (queued) => ({
            ...queued,
            status: "error",
            error: message
          }));
        }
      }

      const hasErrors = results.some((entry) => entry.result.status === "error");
      const hasSuccess = results.some((entry) => entry.result.status === "stored");
      const hasDuplicates = results.some((entry) => entry.result.status === "duplicate");

      if (hasErrors) {
        setStatusMessage("Some files failed to upload. Please review the errors below.");
        setStatusType("error");
      } else if (hasSuccess) {
        setStatusMessage("CVs uploaded successfully and queued for virus scanning.");
        setStatusType("success");
      } else if (hasDuplicates) {
        setStatusMessage("All files were identified as duplicates.");
        setStatusType("info");
      }

      setIsUploading(false);
    },
    [
      availabilityDate,
      availabilityNotes,
      availabilityStatus,
      consultantEmail,
      consultantLocation,
      consultantName,
      consultantPhone,
      consultantTitle,
      existingCvId,
      isSubmitDisabled,
      notes,
      queuedFiles,
      skills,
      tags,
      updateFile,
      uploadedBy
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded border border-dashed border-neutral-400 p-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="flex flex-col items-center justify-center gap-4 rounded border border-neutral-300 bg-neutral-50 p-8 text-center"
        >
          <p className="text-lg font-semibold">Drag and drop CV files here</p>
          <p className="text-sm text-neutral-600">PDF, DOC, and DOCX files are supported.</p>
          <label className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Browse files
            <input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileInputChange} />
          </label>
        </div>
        {queuedFiles.length > 0 && (
          <ul className="mt-4 space-y-3">
            {queuedFiles.map((queued) => (
              <li key={queued.id} className="rounded border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{queued.file.name}</p>
                    <p className="text-xs text-neutral-500">{formatBytes(queued.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => removeFile(queued.id)}
                    disabled={isUploading}
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 h-2 w-full rounded bg-neutral-200">
                  <div
                    className="h-2 rounded bg-blue-600 transition-all"
                    style={{ width: `${Math.round((queued.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-sm">
                  {queued.status === "uploading" && <span className="text-blue-600">Uploading…</span>}
                  {queued.status === "success" && <span className="text-green-600">Uploaded</span>}
                  {queued.status === "duplicate" && <span className="text-amber-600">Duplicate detected</span>}
                  {queued.status === "error" && <span className="text-red-600">{queued.error ?? "Upload failed"}</span>}
                  {queued.status === "idle" && <span className="text-neutral-500">Ready to upload</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {queuedFiles.length > 0 && (
          <button
            type="button"
            className="mt-4 text-sm text-neutral-500 hover:underline"
            onClick={resetForm}
            disabled={isUploading}
          >
            Clear files
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Consultant name *</label>
          <input
            type="text"
            required
            value={consultantName}
            onChange={(event) => setConsultantName(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Consultant email</label>
          <input
            type="email"
            value={consultantEmail}
            onChange={(event) => setConsultantEmail(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="jane.doe@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="tel"
            value={consultantPhone}
            onChange={(event) => setConsultantPhone(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Title</label>
          <input
            type="text"
            value={consultantTitle}
            onChange={(event) => setConsultantTitle(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Senior Consultant"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Location</label>
          <input
            type="text"
            value={consultantLocation}
            onChange={(event) => setConsultantLocation(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Berlin, Germany"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Uploaded by</label>
          <input
            type="text"
            value={uploadedBy}
            onChange={(event) => setUploadedBy(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Recruiter name"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Existing CV ID</label>
          <input
            type="text"
            value={existingCvId}
            onChange={(event) => setExistingCvId(event.target.value)}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Optional MongoDB ID"
          />
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h3 className="text-lg font-semibold">Skills</h3>
          <p className="text-sm text-neutral-600">Add relevant skills with optional proficiency and experience.</p>
        </header>
        <div className="space-y-4">
          {skills.map((skill) => (
            <div key={skill.id} className="grid gap-3 rounded border border-neutral-200 p-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-neutral-500">Skill</label>
                <input
                  type="text"
                  value={skill.name}
                  onChange={(event) => handleSkillChange(skill.id, "name", event.target.value)}
                  className="w-full rounded border border-neutral-300 p-2"
                  placeholder="JavaScript"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-neutral-500">Level</label>
                <input
                  type="text"
                  value={skill.level}
                  onChange={(event) => handleSkillChange(skill.id, "level", event.target.value)}
                  className="w-full rounded border border-neutral-300 p-2"
                  placeholder="Expert"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-neutral-500">Years</label>
                <input
                  type="number"
                  min="0"
                  value={skill.years}
                  onChange={(event) => handleSkillChange(skill.id, "years", event.target.value)}
                  className="w-full rounded border border-neutral-300 p-2"
                  placeholder="5"
                />
              </div>
              <div className="md:col-span-3">
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => handleRemoveSkill(skill.id)}
                >
                  Remove skill
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="rounded bg-neutral-200 px-4 py-2 text-sm" onClick={handleAddSkill}>
            Add skill
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-lg font-semibold">Availability</h3>
          <p className="text-sm text-neutral-600">Let recruiters know when the consultant can start.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Status</label>
            <select
              value={availabilityStatus}
              onChange={(event) => setAvailabilityStatus(event.target.value as MetadataPayload["availability"]["status"])}
              className="w-full rounded border border-neutral-300 p-2"
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Available from</label>
            <input
              type="date"
              value={availabilityDate}
              onChange={(event) => setAvailabilityDate(event.target.value)}
              className="w-full rounded border border-neutral-300 p-2"
            />
          </div>
          <div className="md:col-span-3 space-y-2">
            <label className="block text-sm font-medium">Availability notes</label>
            <textarea
              value={availabilityNotes}
              onChange={(event) => setAvailabilityNotes(event.target.value)}
              className="w-full rounded border border-neutral-300 p-2"
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-lg font-semibold">Tags & Notes</h3>
          <p className="text-sm text-neutral-600">Attach quick labels and notes to help categorize the CV.</p>
        </header>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tags</label>
          <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-300 p-2">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-2 rounded bg-neutral-200 px-2 py-1 text-sm">
                {tag}
                <button type="button" className="text-xs text-red-600" onClick={() => removeTag(tag)}>
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type a tag and press Enter"
              className="flex-1 min-w-[120px] border-none focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded border border-neutral-300 p-2"
            placeholder="Add any contextual information about the candidate"
          />
        </div>
      </section>

      {statusMessage && (
        <div
          className={
            statusType === "success"
              ? "rounded border border-green-500 bg-green-50 p-4 text-green-800"
              : statusType === "error"
              ? "rounded border border-red-500 bg-red-50 p-4 text-red-800"
              : "rounded border border-blue-400 bg-blue-50 p-4 text-blue-800"
          }
        >
          {statusMessage}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="rounded bg-blue-600 px-6 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isUploading ? "Uploading…" : "Upload CVs"}
        </button>
        <span className="text-sm text-neutral-500">Files will be scanned for viruses automatically after upload.</span>
      </div>
    </form>
  );
}

export default CvUploadForm;

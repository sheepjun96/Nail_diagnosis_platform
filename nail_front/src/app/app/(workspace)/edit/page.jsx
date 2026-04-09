"use client";

import { PatientEditorPage } from "@/components/workspace/patient-editor-page";
import { Suspense } from "react";

function EditPageContent() {
  return (
    <PatientEditorPage
      breadcrumb="Project > Edit Patient"
      seriesRouteBase="/app/edit"
      title="Edit Patient"
    />
  );
}

export default function EditPage() {
  return (
    <Suspense>
      <EditPageContent />
    </Suspense>
  );
}

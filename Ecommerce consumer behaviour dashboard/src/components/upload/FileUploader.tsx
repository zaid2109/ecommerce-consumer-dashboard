"use client";

import React from "react";

type FileUploaderProps = {
  accept?: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  label?: string;
};

export const FileUploader = ({
  accept = ".csv,text/csv",
  disabled,
  onFileSelected,
  label = "Upload CSV",
}: FileUploaderProps) => {
  return (
    <label className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg cursor-pointer disabled:opacity-60">
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelected(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
};

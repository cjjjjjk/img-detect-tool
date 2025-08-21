import { useState, useMemo } from "react";
import React, { InputHTMLAttributes } from "react";

// Extend the InputHTMLAttributes interface to include webkitdirectory
declare module "react" {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: "true" | "false";
    }
}

const ITEMS_PER_PAGE = 50;

export default function InputContainer() {
    const [files, setFiles] = useState<File[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;

        setIsUploading(true);
        setUploadProgress(0);

        const fileArray = Array.from(newFiles).filter((f) =>
            f.type.startsWith("image/")
        );

        // Giả lập quá trình tải lên bằng setTimeout
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress <= 100) {
                setUploadProgress(progress);
            } else {
                clearInterval(interval);
                setIsUploading(false);
                setFiles((prev) => [...prev, ...fileArray]);
                setCurrentPage(1);
            }
        }, 100);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    const handleDelete = (idx: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
        if (currentPage > Math.ceil((files.length - 1) / ITEMS_PER_PAGE)) {
            setCurrentPage(Math.max(1, currentPage - 1));
        }
    };

    const getExtension = (filename: string) => {
        const parts = filename.split(".");
        return parts.length > 1 ? `.${parts.pop()}` : "";
    };

    const onSelectImg = (file: File) => {
        console.log(file.name);
    };

    // Logic phân trang
    const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    const currentFiles = useMemo(() => {
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return files.slice(startIndex, endIndex);
    }, [files, currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const renderPaginationButtons = () => {
        const buttons = [];
        const maxButtonsToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1);

        if (endPage - startPage + 1 < maxButtonsToShow) {
            startPage = Math.max(1, endPage - maxButtonsToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            buttons.push(
                <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`h-8 w-8 rounded-full mx-1 ${currentPage === i
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                >
                    {i}
                </button>
            );
        }
        return buttons;
    };

    return (
        <div>
            <div
                className="border border-dashed border-gray-400 px-3 py-2 rounded-xl"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
            >
                <input
                    id="fileInput"
                    type="file"
                    accept="image/*"
                    multiple
                    webkitdirectory="true"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <p className="text-gray-600">select images</p>
            </div>

            {isUploading ? (
                <div className="mt-4 p-4 text-center">
                    <p className="text-gray-600 mb-2">uploading...</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{uploadProgress}%</p>
                </div>
            ) : files.length > 0 ? (
                <>
                    <div className="mt-4 flex flex-col gap-2 max-h-[70vh] overflow-y-auto px-3">
                        {currentFiles.map((file, idx) => (
                            <div
                                key={startIndex + idx}
                                className="flex items-center justify-between cursor-pointer hover:bg-white/40"
                                onClick={() => onSelectImg(file)}
                            >
                                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                    <span className="text-sm truncate">{file.name}</span>
                                </div>
                                <span className="text-xs shrink-0 bg-orange-400 text-white rounded-sm px-1 font-bold">
                                    {getExtension(file.name)}
                                </span>
                                <button
                                    className="ml-2 px-2 py-1 text-black text-xs rounded hover:text-red-500 hover:cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(startIndex + idx);
                                    }}
                                >
                                    X
                                </button>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-4 flex justify-center items-center">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-2 py-1 mx-1 rounded bg-gray-200 disabled:opacity-50"
                            >
                                ◀
                            </button>
                            {renderPaginationButtons()}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 mx-1 rounded bg-gray-200 disabled:opacity-50"
                            >
                                ▶
                            </button>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
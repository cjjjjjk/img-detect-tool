"use client";
import { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import React, { InputHTMLAttributes } from "react";

// Extend the InputHTMLAttributes interface to include webkitdirectory
declare module "react" {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: "true" | "false";
    }
}
export interface InputContainerHandle {
    nextImage: () => void;
    prevImage: () => void;
}
const ITEMS_PER_PAGE = 50;

interface InputContainerProps {
    isWidthCollapsed: boolean;
    onFileSelect: (file: File | null) => void;
    onFilesChange: (files: File[]) => void;

    mode: 'detection' | 'segmentation';
    onModeChange: (mode: 'detection' | 'segmentation') => void;
}

const InputContainer = forwardRef<InputContainerHandle, InputContainerProps>(
    ({ onFileSelect, isWidthCollapsed, onFilesChange, mode, onModeChange }, ref) => {
        // Ui control vars
        const [isUploading, setIsUploading] = useState(false);
        const [uploadProgress, setUploadProgress] = useState(0);
        const [isCollapsed, setIsCollapsed] = useState<boolean>(isWidthCollapsed)

        // file control vars
        const [files, setFiles] = useState<File[]>([]);
        const [currentPage, setCurrentPage] = useState(1);
        const [selectedImgIdx, setSelectedImgIdx] = useState<null | number>(null)


        // Logic phân trang
        const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

        const currentFiles = useMemo(() => {
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const fileRs = files.slice(startIndex, endIndex);
            return fileRs
        }, [files, currentPage]);

        const handlePageChange = (page: number) => {
            const startIndex = (page - 1) * ITEMS_PER_PAGE;
            setCurrentPage(page);

            setSelectedImgIdx(startIndex);
            onFileSelect(files[startIndex]);
        };

        useImperativeHandle(ref, () => ({
            nextImage() {
                if (selectedImgIdx != null) {
                    if (selectedImgIdx === startIndex + ITEMS_PER_PAGE - 1) {
                        if (currentPage < totalPages) {
                            const nextPage = currentPage + 1;
                            const nextStartIndex = (nextPage - 1) * ITEMS_PER_PAGE;
                            setCurrentPage(nextPage);
                            onSelectImg(files[nextStartIndex], nextStartIndex);
                        }
                    } else {
                        onSelectImg(
                            currentFiles[selectedImgIdx - startIndex + 1],
                            selectedImgIdx + 1
                        );
                    }
                }
            },

            prevImage() {
                if (selectedImgIdx != null) {
                    if (selectedImgIdx === startIndex) {
                        if (currentPage > 1) {
                            const prevPage = currentPage - 1;
                            const prevStartIndex = (prevPage - 1) * ITEMS_PER_PAGE;
                            const prevEndIndex = prevStartIndex + ITEMS_PER_PAGE - 1;
                            const lastIndex = Math.min(prevEndIndex, files.length - 1);

                            setCurrentPage(prevPage);
                            onSelectImg(files[lastIndex], lastIndex);
                        }
                    } else {
                        onSelectImg(
                            currentFiles[selectedImgIdx - startIndex - 1],
                            selectedImgIdx - 1
                        );
                    }
                }
            },
        }));

        // ui handlers
        useEffect(() => {
            if (!files.length) return;
            setIsCollapsed(isWidthCollapsed)
        }, [isWidthCollapsed])

        const handleFiles = async (newFiles: FileList | null) => {
            if (!newFiles) return;

            setIsUploading(true);
            setUploadProgress(0);
            let progress = 0;

            const fileArray = Array.from(newFiles).filter((f) =>
                f.type.startsWith("image/")
            );

            const interval = setInterval(() => {
                if (progress < 80) {
                    progress += 2;
                    setUploadProgress(progress);
                }
            }, 100);

            try {
                await new Promise((resolve) => setTimeout(resolve, 2000));

                clearInterval(interval);
                setUploadProgress(100);

                setTimeout(() => {
                    setIsUploading(false);
                    // Cập nhật state và báo cáo danh sách file mới
                    setFiles((prev) => {
                        const newFileSet = [...prev, ...fileArray];
                        onFilesChange(newFileSet); // <-- MỚI: Báo cáo danh sách đầy đủ
                        return newFileSet;
                    });
                    setCurrentPage(1);

                    if (fileArray.length > 0) {
                        onSelectImg(fileArray[0], 0);
                    }
                }, 500);
            } catch (err) {
                clearInterval(interval);
                setIsUploading(false);
            } finally {

            }
        };


        const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
        };

        const handleDelete = (idx: number) => {
            const newFiles = files.filter((_, i) => i !== idx); // Tính toán danh sách mới
            setFiles(newFiles); // Cập nhật state
            onFilesChange(newFiles); // <-- MỚI: Báo cáo danh sách đầy đủ

            if (currentPage > Math.ceil((newFiles.length) / ITEMS_PER_PAGE)) {
                setCurrentPage(Math.max(1, currentPage - 1));
            }

            // Xử lý nếu xóa ảnh đang chọn
            if (selectedImgIdx === idx) {
                if (newFiles.length === 0) {
                    onFileSelect(null); // Không còn file nào
                    setSelectedImgIdx(null);
                } else if (idx >= newFiles.length) {
                    // Nếu xóa file cuối, chọn file trước đó
                    onSelectImg(newFiles[newFiles.length - 1], newFiles.length - 1);
                } else {
                    // Ngược lại, chọn file ở vị trí index cũ (bây giờ là file mới)
                    onSelectImg(newFiles[idx], idx);
                }
            } else if (selectedImgIdx && selectedImgIdx > idx) {
                // Nếu xóa file ở trước file đang chọn, giảm index
                setSelectedImgIdx(selectedImgIdx - 1);
            }
        };

        const getExtension = (filename: string) => {
            const parts = filename.split(".");
            return parts.length > 1 ? `.${parts.pop()}` : "";
        };

        const onSelectImg = (file: File, index?: number) => {
            if (index != null) {
                setSelectedImgIdx(index)
            }
            onFileSelect(file);
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
                        className={`h-8 w-8 rounded-full mx-1 text-xs font-semibold ${currentPage === i
                            ? "bg-blue-600 text-white"
                            : "bg-gray-300 text-gray-800 hover:bg-gray-400/50"
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
                {!isCollapsed && (
                    <div className="p-2 bg-gray-300 rounded mb-2 text-sm text-gray-800">
                        <label className="mr-3 cursor-pointer">
                            <input
                                type="radio"
                                value="detection"
                                checked={mode === 'detection'}
                                onChange={() => onModeChange('detection')}
                                className="mr-1"
                            />
                            Detection
                        </label>
                        <br />
                        <label className="cursor-pointer">
                            <input
                                type="radio"
                                value="segmentation"
                                checked={mode === 'segmentation'}
                                onChange={() => onModeChange('segmentation')}
                                className="mr-1"
                            />
                            Segmentation
                        </label>
                    </div>
                )}

                <div
                    className="border-2 border-dashed border-gray-400 px-3 py-4 rounded-xl text-center cursor-pointer hover:border-blue-500 hover:bg-gray-100/30 transition-colors"
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
                    {isCollapsed ? (
                        <p className="text-gray-700 font-medium">Select</p>
                    ) : (
                        <>
                            <p className="text-gray-700 font-medium">Select Image Folder</p>
                            <p className="text-xs text-gray-500">or drag and drop</p>
                        </>
                    )}
                </div>

                {isUploading ? (
                    <div className="mt-4 p-4 text-center">
                        <p className="text-gray-600 mb-2">Uploading...</p>
                        <div className="w-full bg-gray-300 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">{uploadProgress}%</p>
                    </div>
                ) : files.length > 0 ? (
                    <>
                        <div className="mt-4 flex flex-col gap-1 max-h-[70vh] overflow-y-auto px-1">
                            {currentFiles.map((file, idx) => (
                                <div
                                    key={startIndex + idx}
                                    className={`flex items-center justify-between cursor-pointer rounded p-1.5 ${(startIndex + idx) == selectedImgIdx
                                        ? "bg-blue-100 border border-blue-300 text-blue-800"
                                        : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                    onClick={() => onSelectImg(file, startIndex + idx)}
                                >
                                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                        <span className="text-sm truncate font-medium">{file.name}</span>
                                    </div>
                                    {
                                        !isCollapsed &&
                                        <span className="text-xs shrink-0 bg-gray-500 text-white rounded-sm px-1 font-bold">
                                            {getExtension(file.name)}
                                        </span>
                                    }
                                    {
                                        !isCollapsed &&
                                        <button
                                            className="ml-2 px-2 py-1 text-gray-400 text-xs rounded hover:text-red-600 hover:cursor-pointer font-bold"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(startIndex + idx);
                                            }}
                                        >
                                            X
                                        </button>
                                    }
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-4 flex justify-center items-center">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 mx-1 rounded bg-gray-300 disabled:opacity-50"
                                >
                                    ◀
                                </button>
                                {renderPaginationButtons()}
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 mx-1 rounded bg-gray-300 disabled:opacity-50"
                                >
                                    ▶
                                </button>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        );
    })
export default InputContainer;
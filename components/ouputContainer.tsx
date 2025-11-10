import { Annotation, ImageSize, ClassInfo, Keypoint } from "@/pages"; // Import kiểu từ index
import { useState } from "react";
import React, { InputHTMLAttributes } from "react"; // Import React và các kiểu

// Bổ sung khai báo cho webkitdirectory
declare module "react" {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: "true" | "false";
    }
}

interface OutputContainerProps {
    annotations: Annotation[];
    onAnnotationsChange: (data: Annotation[]) => void;
    imageName: string;
    imageSize: ImageSize;
    // Props mới cho import
    classes: ClassInfo[];
    allImageFiles: File[];
    onBulkAnnotationsUpdate: (newAnnotations: Map<string, Annotation[]>) => void;
    keypointCount: number; // <-- MỚI: Nhận số KPT
}

export default function OutputContainer({
    annotations,
    onAnnotationsChange,
    imageName,
    imageSize,
    classes,
    allImageFiles,
    onBulkAnnotationsUpdate,
    keypointCount, // <-- MỚI
}: OutputContainerProps) {

    const [isImporting, setIsImporting] = useState(false);

    // === CẬP NHẬT: Hàm chuyển đổi sang định dạng YOLO Pose (N Keypoints) ===
    const getRequiredYoloPoseFormat = (): string => {
        const { naturalW, naturalH } = imageSize;
        if (naturalW <= 1 || naturalH <= 1) return "";

        const lines: string[] = [];

        for (const ann of annotations) {
            const { box, keypoints, classId } = ann;

            // Tính toán box (giữ nguyên)
            const x_center = (box.x + box.w / 2) / naturalW;
            const y_center = (box.y + box.h / 2) / naturalH;
            const w_norm = box.w / naturalW;
            const h_norm = box.h / naturalH;

            const lineParts = [
                classId,
                x_center.toFixed(6),
                y_center.toFixed(6),
                w_norm.toFixed(6),
                h_norm.toFixed(6),
            ];

            // === MỚI: Xử lý N keypoints ===
            if (keypointCount > 0) {
                // Yêu cầu tất cả KPT phải được gán (không được null)
                if (keypoints.length !== keypointCount || keypoints.some(k => k === null)) {
                    // Nếu dùng logic chỉ export khi đủ KPT, bật dòng này
                    // continue; 
                }

                const kptParts = keypoints.flatMap(kpt => {
                    if (kpt) {
                        // vis=2: labeled and visible
                        return [(kpt.x / naturalW).toFixed(6), (kpt.y / naturalH).toFixed(6), 2];
                    } else {
                        // vis=0: not labeled/visible
                        return ["0.000000", "0.000000", 0];
                    }
                });

                // Đảm bảo luôn export đủ N*3 giá trị KPT
                for (let i = keypoints.length; i < keypointCount; i++) {
                    kptParts.push("0.000000", "0.000000", 0);
                }

                lineParts.push(...kptParts);
            }

            lines.push(lineParts.join(" "));
        }

        return lines.join("\n");
    };


    const downloadFile = () => {
        if (!imageName) {
            alert("No image selected.");
            return;
        }
        const content = getRequiredYoloPoseFormat();
        const nameWithoutExt = imageName.split('.').slice(0, -1).join('.');
        const fileName = `${nameWithoutExt}.txt`;
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDelete = (id: string) => {
        const newAnns = annotations.filter((ann) => ann.id !== id);
        onAnnotationsChange(newAnns);
    };

    // === CẬP NHẬT: Xử lý IMPORT (N Keypoints) ===
    const handleLabelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setIsImporting(true);

        const txtFiles = Array.from(uploadedFiles).filter(f => f.name.endsWith('.txt'));
        const newAnnotationsMap = new Map<string, Annotation[]>();

        const getDimensions = (file: File): Promise<{ w: number, h: number }> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);
                img.onload = () => {
                    resolve({ w: img.naturalWidth, h: img.naturalHeight });
                    URL.revokeObjectURL(objectUrl);
                };
                img.onerror = (err) => {
                    reject(err);
                    URL.revokeObjectURL(objectUrl);
                };
                img.src = objectUrl;
            });
        };

        for (const txtFile of txtFiles) {
            try {
                const baseName = txtFile.name.split('.').slice(0, -1).join('.');
                const matchingImageFile = allImageFiles.find(imgFile =>
                    imgFile.name.split('.').slice(0, -1).join('.') === baseName
                );

                if (!matchingImageFile) {
                    console.warn(`No matching image found for label: ${txtFile.name}`);
                    continue;
                }

                const { w: naturalW, h: naturalH } = await getDimensions(matchingImageFile);
                if (naturalW <= 1 || naturalH <= 1) continue;

                const content = await txtFile.text();
                const lines = content.split('\n').filter(line => line.trim() !== '');
                const parsedAnnotations: Annotation[] = [];

                for (const line of lines) {
                    const parts = line.split(' ').map(Number);

                    // MỚI: Kiểm tra số lượng phần tử = 5 (class+box) + N*3 (kpts)
                    const expectedParts = 5 + (keypointCount * 3);

                    // Nếu không có KPT, chỉ cần 5 phần tử
                    const minExpectedParts = (keypointCount > 0) ? expectedParts : 5;

                    if (parts.length < minExpectedParts) {
                        console.warn(`Skipping line: Expected ${minExpectedParts} parts, got ${parts.length}`);
                        continue;
                    }

                    // Nếu số KPT > 0, nhưng file lại có ít hơn mong đợi (ví dụ chỉ có 5) -> bỏ qua
                    if (keypointCount > 0 && parts.length < expectedParts) {
                        console.warn(`Skipping line: Mismatch keypoint count. Expected ${expectedParts} parts, got ${parts.length}`);
                        continue;
                    }

                    const [classId, x_c, y_c, w_n, h_n] = parts;

                    const classInfo = classes.find(c => c.id === classId);
                    if (!classInfo) continue;

                    // Box (giữ nguyên)
                    const w = w_n * naturalW;
                    const h = h_n * naturalH;
                    const x = (x_c * naturalW) - (w / 2);
                    const y = (y_c * naturalH) - (h / 2);

                    // === MỚI: Phân tích N keypoints ===
                    const parsedKeypoints: (Keypoint | null)[] = [];
                    if (keypointCount > 0) {
                        for (let i = 0; i < keypointCount; i++) {
                            const kpt_x_n = parts[5 + (i * 3)];
                            const kpt_y_n = parts[5 + (i * 3) + 1];
                            const kpt_vis = parts[5 + (i * 3) + 2];

                            if (kpt_vis === 0) {
                                parsedKeypoints.push(null); // Kpt không được gán
                            } else {
                                parsedKeypoints.push({
                                    x: Math.round(kpt_x_n * naturalW),
                                    y: Math.round(kpt_y_n * naturalH),
                                });
                            }
                        }
                    }

                    const newAnn: Annotation = {
                        id: crypto.randomUUID(),
                        classId: classInfo.id,
                        className: classInfo.name,
                        box: {
                            x: Math.round(x),
                            y: Math.round(y),
                            w: Math.round(w),
                            h: Math.round(h),
                        },
                        keypoints: parsedKeypoints, // <-- MỚI
                    };
                    parsedAnnotations.push(newAnn);
                }

                if (parsedAnnotations.length > 0) {
                    newAnnotationsMap.set(matchingImageFile.name, parsedAnnotations);
                }

            } catch (err) {
                console.error(`Failed to process label file ${txtFile.name}:`, err);
            }
        }

        if (newAnnotationsMap.size > 0) {
            onBulkAnnotationsUpdate(newAnnotationsMap);
            alert(`Successfully imported and applied ${newAnnotationsMap.size} label file(s) (Note: Labels may be ignored if keypoint count doesn't match current settings).`);
        } else {
            alert('No valid label files found or matched.');
        }

        setIsImporting(false);
        if (e.target) e.target.value = '';
    };


    return (
        // Container đã được sửa lỗi cuộn ở phiên bản trước
        <div className="p-4 border rounded mt-4 overflow-hidden min-h-[30vh] max-h-[80vh] flex flex-col bg-white/50">
            <input
                type="file"
                id="labelInput"
                webkitdirectory="true"
                multiple
                className="hidden"
                onChange={handleLabelImport}
                accept=".txt"
            />

            {/* === CẬP NHẬT UI: Nút Upload nằm trên cùng hàng với tiêu đề === */}
            <h2 className="font-semibold mb-2 w-full text-gray-800 flex justify-between">Output Data (Current Image)

                <button
                    onClick={() => document.getElementById("labelInput")?.click()}
                    className="px-3 py-1 bg-green-600 text-white rounded  font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isImporting || allImageFiles.length === 0}
                >
                    {isImporting ? "Importing..." : "▲ Upload"}
                </button>
            </h2>
            <p className="text-sm mb-2  text-black">File: <strong className="text-black">{imageName || "N/A"}</strong></p>

            {/* Container cuộn cho bảng */}
            <div className="flex-grow overflow-y-auto border border-gray-300 rounded">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0">
                        <tr className="bg-gray-200 text-gray-700">
                            {/* NÂNG CẤP: Thêm cột STT */}
                            <th className="border-b border-gray-500 px-3 py-2 text-center">#</th>
                            <th className="border-b border-gray-500 px-3 py-2 text-left">Class</th>
                            <th className="border-b border-gray-500 px-3 py-2 text-left">Box (x,y,w,h)</th>

                            {/* === THAY ĐỔI: Ẩn/hiện cột Keypoints === */}
                            {keypointCount > 0 && (
                                <th className="border-b border-gray-500 px-3 py-2 text-left">Keypoints (x,y)</th>
                            )}

                            <th className="border-b border-gray-500 px-3 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* NÂNG CẤP: Thêm 'index' vào map */}
                        {annotations.map((d, index) => (
                            <tr key={d.id} className="hover:bg-gray-100/50">
                                {/* NÂNG CẤP: Hiển thị STT (index + 1) */}
                                <td className="border-b border-gray-400 px-3 text-black py-1.5 text-center font-mono text-xs">
                                    {index + 1}
                                </td>
                                <td className="border-b border-gray-400 px-3 text-black py-1.5">{d.className} ({d.classId})</td>
                                <td className="border-b border-gray-400 px-3 text-black py-1.5 font-mono text-xs">
                                    {`(${d.box.x}, ${d.box.y}) [${d.box.w}x${d.box.h}]`}
                                </td>

                                {/* === THAY ĐỔI: Ẩn/hiện cột Keypoints === */}
                                {keypointCount > 0 && (
                                    <td className="border-b border-gray-400 px-3 text-black py-1.5 font-mono text-xs">
                                        {d.keypoints.map((k, i) => (
                                            <span key={i} className={`mr-1 ${k ? '' : 'text-gray-400'}`}>
                                                [{i + 1}: {k ? `${k.x},${k.y}` : 'N/A'}]
                                            </span>
                                        ))}
                                    </td>
                                )}

                                <td className="border-b border-gray-400 px-3 text-black py-1.5 text-center">
                                    <button
                                        className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-semibold hover:bg-red-600"
                                        onClick={() => handleDelete(d.id)}
                                    >
                                        Del
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {annotations.length === 0 && (
                            <tr>
                                {/* NÂNG CẤP: Cập nhật colSpan (từ 4->5 và 3->4) */}
                                <td colSpan={keypointCount > 0 ? 5 : 4} className="text-center p-4 text-gray-500">No annotations yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <button
                    onClick={downloadFile}
                    className="px-3 py-2 bg-blue-600 text-white rounded w-full font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!imageName || annotations.length === 0}
                >
                    Download {imageName.split('.').slice(0, -1).join('.') || 'labels'}.txt
                </button>
            </div>

        </div>
    );
}
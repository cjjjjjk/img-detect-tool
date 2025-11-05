import { Annotation, ImageSize, ClassInfo } from "@/pages"; // Import kiểu từ index
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
    CLASSES: ClassInfo[];
    allImageFiles: File[];
    onBulkAnnotationsUpdate: (newAnnotations: Map<string, Annotation[]>) => void;
}

export default function OutputContainer({
    annotations,
    onAnnotationsChange,
    imageName,
    imageSize,
    CLASSES,
    allImageFiles,
    onBulkAnnotationsUpdate,
}: OutputContainerProps) {

    const [isImporting, setIsImporting] = useState(false);

    // Hàm chuyển đổi sang định dạng YOLO Pose (Không đổi)
    const getRequiredYoloPoseFormat = (): string => {
        const { naturalW, naturalH } = imageSize;
        if (naturalW <= 1 || naturalH <= 1) return ""; // Chưa có kích thước ảnh

        const lines: string[] = [];

        for (const ann of annotations) {
            // Chỉ export những annotation đã có cả box và keypoint
            if (!ann.keypoint) continue;

            const { box, keypoint, classId } = ann;

            // Tính toán tọa độ chuẩn hóa (normalized)
            const x_center = (box.x + box.w / 2) / naturalW;
            const y_center = (box.y + box.h / 2) / naturalH;
            const w_norm = box.w / naturalW;
            const h_norm = box.h / naturalH;

            const kpt_x = keypoint.x / naturalW;
            const kpt_y = keypoint.y / naturalH;
            const kpt_vis = 2; // 2 = visible and labeled

            // Format: <class_id> <x_center> <y_center> <w> <h> <kpt1_x> <kpt1_y> <kpt1_vis>
            const line = [
                classId,
                x_center.toFixed(6),
                y_center.toFixed(6),
                w_norm.toFixed(6),
                h_norm.toFixed(6),
                kpt_x.toFixed(6),
                kpt_y.toFixed(6),
                kpt_vis
            ].join(" ");

            lines.push(line);
        }

        return lines.join("\n");
    };


    const downloadFile = () => {
        if (!imageName) {
            alert("No image selected.");
            return;
        }

        const content = getRequiredYoloPoseFormat();

        // Lấy tên file không bao gồm extension
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
        // Tạo mảng mới bằng cách lọc ra annotation có id cần xóa
        const newAnns = annotations.filter((ann) => ann.id !== id);
        // Gọi callback để cập nhật state ở component cha
        onAnnotationsChange(newAnns);
    };

    // === HÀM MỚI: XỬ LÝ IMPORT LABEL ===
    const handleLabelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setIsImporting(true);

        const txtFiles = Array.from(uploadedFiles).filter(f => f.name.endsWith('.txt'));
        const newAnnotationsMap = new Map<string, Annotation[]>();

        // Hàm helper để lấy kích thước ảnh
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
                // Lấy tên file không có đuôi (ví dụ: 'image1.txt' -> 'image1')
                const baseName = txtFile.name.split('.').slice(0, -1).join('.');

                // Tìm file ảnh tương ứng (ví dụ: 'image1.jpg', 'image1.png')
                const matchingImageFile = allImageFiles.find(imgFile =>
                    imgFile.name.split('.').slice(0, -1).join('.') === baseName
                );

                if (!matchingImageFile) {
                    console.warn(`No matching image found for label: ${txtFile.name}`);
                    continue;
                }

                // Lấy kích thước ảnh
                const { w: naturalW, h: naturalH } = await getDimensions(matchingImageFile);
                if (naturalW <= 1 || naturalH <= 1) continue;

                // Đọc và phân tích tệp nhãn
                const content = await txtFile.text();
                const lines = content.split('\n').filter(line => line.trim() !== '');
                const parsedAnnotations: Annotation[] = [];

                for (const line of lines) {
                    const parts = line.split(' ').map(Number);
                    if (parts.length < 8) continue; // Phải có class + box + keypoint

                    const [classId, x_c, y_c, w_n, h_n, kpt_x_n, kpt_y_n] = parts;

                    // Tìm thông tin class
                    const classInfo = CLASSES.find(c => c.id === classId);
                    if (!classInfo) continue;

                    // Chuyển đổi từ YOLO (normalized, center) sang Natural (pixels, top-left)
                    const w = w_n * naturalW;
                    const h = h_n * naturalH;
                    const x = (x_c * naturalW) - (w / 2);
                    const y = (y_c * naturalH) - (h / 2);

                    const kpt_x = kpt_x_n * naturalW;
                    const kpt_y = kpt_y_n * naturalH;

                    // Tạo đối tượng Annotation
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
                        keypoint: {
                            x: Math.round(kpt_x),
                            y: Math.round(kpt_y),
                        }
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

        // Gửi tất cả cập nhật lên component cha
        if (newAnnotationsMap.size > 0) {
            onBulkAnnotationsUpdate(newAnnotationsMap);
            alert(`Successfully imported ${newAnnotationsMap.size} label file(s).`);
        } else {
            alert('No valid label files found or matched.');
        }

        setIsImporting(false);

        // Xóa giá trị của input file để sự kiện onChange có thể kích hoạt lại
        if (e.target) {
            e.target.value = '';
        }
    };


    return (
        <div className="p-4 border rounded mt-4 overflow-hidden min-h-[30vh] max-h-[80vh] flex flex-col bg-white/50">
            {/* Input ẩn để import folder */}
            <input
                type="file"
                id="labelInput"
                webkitdirectory="true"
                multiple
                className="hidden"
                onChange={handleLabelImport}
                accept=".txt"
            />

            <h2 className="font-semibold mb-2 text-gray-800">Output Data (Current Image)</h2>
            <p className="text-sm mb-2  text-black">File: <strong className="text-black">{imageName || "N/A"}</strong></p>
            <button
                onClick={() => document.getElementById("labelInput")?.click()}
                className="px-3 py-2 bg-green-600 text-white rounded w-full font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isImporting || allImageFiles.length === 0}
            >
                {isImporting ? "Importing..." : "Import Labels (.txt)"}
            </button>

            {/* Đây là container làm cho bảng cuộn được, nó đã tồn tại trong mã của bạn */}
            <div className="flex-grow overflow-y-auto border border-gray-300 rounded">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0">
                        <tr className="bg-gray-200 text-gray-700">
                            <th className="border-b border-gray-500 px-3 py-2 text-left">Class</th>
                            <th className="border-b border-gray-500 px-3 py-2 text-left">Box (x,y,w,h)</th>
                            <th className="border-b border-gray-500 px-3 py-2 text-left">Keypoint (x,y)</th>
                            <th className="border-b border-gray-500 px-3 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {annotations.map((d) => (
                            <tr key={d.id} className="hover:bg-gray-100/50">
                                <td className="border-b border-gray-400 px-3 text-black py-1.5">{d.className} ({d.classId})</td>
                                <td className="border-b border-gray-400 px-3 text-black py-1.5 font-mono text-xs">
                                    {`(${d.box.x}, ${d.box.y}) [${d.box.w}x${d.box.h}]`}
                                </td>
                                <td className="border-b border-gray-400 px-3 text-black py-1.5 font-mono text-xs">
                                    {d.keypoint
                                        ? `(${d.keypoint.x}, ${d.keypoint.y})`
                                        : <span className="text-gray-400">N/A</span>}
                                </td>
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
                                <td colSpan={4} className="text-center p-4 text-gray-500">No annotations yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Cập nhật khu vực nút bấm */}
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
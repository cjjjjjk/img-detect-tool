import { Annotation, ImageSize } from "@/pages"; // Import kiểu từ index

interface OutputContainerProps {
    annotations: Annotation[];
    onAnnotationsChange: (data: Annotation[]) => void;
    imageName: string;
    imageSize: ImageSize;
}

export default function OutputContainer({
    annotations,
    onAnnotationsChange,
    imageName,
    imageSize,
}: OutputContainerProps) {
    // Không cần state nội bộ `data` và `useEffect` nữa

    // Hàm chuyển đổi sang định dạng YOLO Pose
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

    return (
        <div className="p-4 border rounded mt-4 overflow-hidden min-h-[30vh] flex flex-col bg-white/50">
            <h2 className="font-semibold mb-2 text-gray-800">Output Data (Current Image)</h2>
            <p className="text-sm mb-2 truncate text-black">File: <strong className="text-black">{imageName || "N/A"}</strong></p>

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

            {/* Xóa bỏ logic export cũ, thay bằng nút download mới */}
            <div className="mt-4 flex gap-2">
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
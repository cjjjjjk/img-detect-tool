import { useEffect, useState } from "react";
import { imgObjectData } from "@/pages";

interface OutputContainerProps {
    imgData: imgObjectData | null;
}

export default function OutputContainer({ imgData }: OutputContainerProps) {
    const [data, setData] = useState<imgObjectData[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [exportType, setExportType] = useState<"csv" | "txt" | null>(null);

    // cập nhật data khi imgData thay đổi
    useEffect(() => {
        if (!imgData) return;

        setData(prev => {
            const idx = prev.findIndex(d => d.name === imgData.name);
            if (idx !== -1) {
                // update nếu trùng name
                const newArr = [...prev];
                newArr[idx] = imgData;
                return newArr;
            } else {
                // thêm mới nếu khác name
                return [...prev, imgData];
            }
        });
    }, [imgData]);

    const handleExport = (type: "csv" | "txt") => {
        setExportType(type);
        setShowModal(true);
    };

    const downloadFile = () => {
        if (!exportType) return;
        let content = "";

        if (exportType === "csv") {
            const header = "name,x,y,w,h\n";
            const rows = data.map(d => `${d.name},${d.x},${d.y},${d.w},${d.h}`).join("\n");
            content = header + rows;
        } else if (exportType === "txt") {
            content = data
                .map(d => `name=${d.name} x=${d.x} y=${d.y} w=${d.w} h=${d.h}`)
                .join("\n");
        }

        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export_${Math.floor(Math.random() * 100)}.${exportType}`;
        a.click();
        URL.revokeObjectURL(url);
        setShowModal(false);
    };


    const handleDelete = (index: number) => {
        setData((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="p-4 border rounded mt-4">
            <h2 className="font-semibold mb-2">Output Data</h2>

            {/* Bảng dữ liệu */}
            <table className="w-full border text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border px-2">Name</th>
                        <th className="border px-2">X</th>
                        <th className="border px-2">Y</th>
                        <th className="border px-2">W</th>
                        <th className="border px-2">H</th>
                        <th className="border px-2 py-1"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((d, i) => (
                        <tr key={i}>
                            <td className="border px-2">{d.name}</td>
                            <td className="border px-2">{d.x}</td>
                            <td className="border px-2">{d.y}</td>
                            <td className="border px-2">{d.w}</td>
                            <td className="border px-2">{d.h}</td>
                            <td className="border px-2 py-1 text-center">
                                <button
                                    className="bg-red-500 text-white px-2 py-1 rounded"
                                    onClick={() => handleDelete(i)}
                                >
                                    Del
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Nút export */}
            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => handleExport("csv")}
                    className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                    Export CSV
                </button>
                <button
                    onClick={() => handleExport("txt")}
                    className="px-3 py-1 bg-green-600 text-white rounded"
                >
                    Export TXT
                </button>
            </div>

            {/* Modal preview */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded w-[400px]">
                        <h3 className="font-semibold mb-2">
                            Preview ({exportType?.toUpperCase()})
                        </h3>
                        <pre className="bg-gray-100 p-2 rounded h-[200px] overflow-auto text-xs">
                            {exportType === "csv"
                                ? "name,x,y,w,h\n" +
                                data
                                    .map(
                                        d =>
                                            `${d.name},${d.x},${d.y},${d.w},${d.h}`
                                    )
                                    .join("\n")
                                : data
                                    .map(
                                        d =>
                                            `name=${d.name} x=${d.x} y=${d.y} w=${d.w} h=${d.h}`
                                    )
                                    .join("\n")}
                        </pre>
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-3 py-1 bg-gray-400 text-white rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={downloadFile}
                                className="px-3 py-1 bg-blue-600 text-white rounded"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

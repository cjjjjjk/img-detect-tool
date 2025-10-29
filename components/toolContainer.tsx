"use client";

import { Annotation } from "@/pages"; // Import kiểu Annotation từ index
import { useEffect, useRef, useState, useMemo } from "react";

// Định nghĩa các lớp (class) - Đã có tiếng Anh
const CLASSES = [
    { id: 0, name: "car", color: "border-red-500", bg: "bg-red-500/20" },
    { id: 1, name: "bus", color: "border-blue-500", bg: "bg-blue-500/20" },
    { id: 2, name: "truck", color: "border-green-500", bg: "bg-green-500/20" },
    { id: 3, name: "motorcycle", color: "border-yellow-500", bg: "bg-yellow-500/20" },
];

// Props mới
interface ToolContainerProps {
    file: File | null;
    annotations: Annotation[];
    onAnnotationsChange: (data: Annotation[]) => void;
    onImageLoad: (size: {
        naturalW: number;
        naturalH: number;
        displayW: number;
        displayH: number;
    }) => void;
}

// Kiểu Box giữ nguyên
interface Box {
    x: number; // display x
    y: number; // display y
    w: number; // display width
    h: number; // display height
    realX: number; // natural x
    realY: number; // natural y
    realW: number; // natural width
    realH: number; // natural height
}

// Kiểu Annotation được hiển thị (đã scale)
interface DisplayAnnotation extends Annotation {
    displayBox: { x: number; y: number; w: number; h: number };
    displayKeypoint: { x: number; y: number } | null;
}

export default function ToolContainer({
    file,
    annotations,
    onAnnotationsChange,
    onImageLoad,
}: ToolContainerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imgWrapperRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
        null
    );
    // Đổi tên `currentBox` thành `drawingBox`
    const [drawingBox, setDrawingBox] = useState<Box | null>(null);

    // State quản lý kích thước (giữ nguyên)
    const [imgSize, setImgSize] = useState<{
        naturalW: number;
        naturalH: number;
        displayW: number;
        displayH: number;
    }>({
        naturalW: 1,
        naturalH: 1,
        displayW: 1,
        displayH: 1,
    });

    // === STATE MỚI ===
    // State cho chế độ: 'draw_box' (vẽ hộp) hoặc 'add_keypoint' (thêm điểm)
    const [mode, setMode] = useState<"draw_box" | "add_keypoint">("draw_box");
    // State cho class đang được chọn
    const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
    // State cho ID của box đang chờ gán keypoint
    const [pendingKeypointBoxId, setPendingKeypointBoxId] = useState<string | null>(
        null
    );

    const url = file ? URL.createObjectURL(file) : null;

    // Hàm clampToWrapper (giữ nguyên)
    const clampToWrapper = (clientX: number, clientY: number) => {
        if (!imgWrapperRef.current) return { x: 0, y: 0 };
        const rect = imgWrapperRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        return { x, y };
    };

    // === CẬP NHẬT LOGIC EVENTS ===

    const handleMouseDown = (e: React.MouseEvent) => {
        // Chỉ cho phép vẽ khi có file và đang ở chế độ 'draw_box'
        if (!file || !imgWrapperRef.current || mode !== "draw_box" || e.button !== 0) {
            // e.button !== 0 -> đảm bảo là chuột trái
            return;
        }

        const { x, y } = clampToWrapper(e.clientX, e.clientY);

        setStartPos({ x, y });
        setDrawingBox({
            x,
            y,
            w: 0,
            h: 0,
            realX: 0,
            realY: 0,
            realW: 0,
            realH: 0,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Chỉ di chuyển khi đang vẽ (startPos tồn tại)
        if (!startPos || !file || !drawingBox) return;

        const { x: x2, y: y2 } = clampToWrapper(e.clientX, e.clientY);
        const w = Math.abs(x2 - startPos.x);
        const h = Math.abs(y2 - startPos.y);
        const x = Math.min(startPos.x, x2);
        const y = Math.min(startPos.y, y2);

        const scaleX = imgSize.naturalW / imgSize.displayW;
        const scaleY = imgSize.naturalH / imgSize.displayH;

        setDrawingBox({
            ...drawingBox,
            x,
            y,
            w,
            h,
            realX: Math.round(x * scaleX),
            realY: Math.round(y * scaleY),
            realW: Math.round(w * scaleX),
            realH: Math.round(h * scaleY),
        });
    };

    const handleMouseUp = () => {
        // Chỉ xử lý khi thả chuột sau khi vẽ
        if (startPos && drawingBox && file) {
            // Đảm bảo box có kích thước tối thiểu
            if (drawingBox.w < 5 || drawingBox.h < 5) {
                setDrawingBox(null);
                setStartPos(null);
                return;
            }

            // Chuẩn hóa tọa độ (top-left, w, h dương)
            const realX = Math.min(
                drawingBox.realX,
                drawingBox.realX + drawingBox.realW
            );
            const realY = Math.min(
                drawingBox.realY,
                drawingBox.realY + drawingBox.realH
            );
            const realW = Math.abs(drawingBox.realW);
            const realH = Math.abs(drawingBox.realH);

            // Tạo annotation mới
            const newAnnotation: Annotation = {
                id: crypto.randomUUID(), // ID ngẫu nhiên
                classId: selectedClass.id,
                className: selectedClass.name,
                box: { x: realX, y: realY, w: realW, h: realH },
                keypoint: null, // Chưa có keypoint
            };

            // Gửi danh sách annotation mới (bao gồm cái vừa tạo) lên component cha
            onAnnotationsChange([...annotations, newAnnotation]);

            // Chuyển sang chế độ 'add_keypoint' và lưu ID của box vừa tạo
            setMode("add_keypoint");
            setPendingKeypointBoxId(newAnnotation.id);
        }

        // Reset trạng thái vẽ
        setDrawingBox(null);
        setStartPos(null);
    };

    // === HÀM MỚI: Xử lý chuột phải ===
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); // Ngăn menu chuột phải của trình duyệt

        // Chỉ hoạt động khi có file và đang ở chế độ 'add_keypoint'
        if (!file || mode !== "add_keypoint" || !pendingKeypointBoxId) return;

        // Tìm annotation đang chờ
        const annToUpdate = annotations.find(
            (a) => a.id === pendingKeypointBoxId
        );
        if (!annToUpdate) return;

        // Lấy tọa độ click (display) và scale sang (natural)
        const { x, y } = clampToWrapper(e.clientX, e.clientY);
        const scaleX = imgSize.naturalW / imgSize.displayW;
        const scaleY = imgSize.naturalH / imgSize.displayH;
        const kptX = Math.round(x * scaleX);
        const kptY = Math.round(y * scaleY);

        // Kiểm tra xem keypoint có nằm trong bounding box không
        const box = annToUpdate.box;
        if (
            kptX >= box.x &&
            kptX <= box.x + box.w &&
            kptY >= box.y &&
            kptY <= box.y + box.h
        ) {
            // Cập nhật keypoint cho annotation đó
            const updatedAnns = annotations.map((a) =>
                a.id === pendingKeypointBoxId
                    ? { ...a, keypoint: { x: kptX, y: kptY } }
                    : a
            );
            onAnnotationsChange(updatedAnns);

            // Reset, quay về chế độ vẽ
            setMode("draw_box");
            setPendingKeypointBoxId(null);
        } else {
            // Nếu click ngoài box, hủy chế độ thêm keypoint
            alert("Keypoint must be inside the bounding box. Please try again.");
            // Hoặc có thể reset
            // setMode("draw_box");
            // setPendingKeypointBoxId(null);
        }
    };

    const handleImageLoad = () => {
        if (imgRef.current) {
            const newSize = {
                naturalW: imgRef.current.naturalWidth,
                naturalH: imgRef.current.naturalHeight,
                displayW: imgRef.current.clientWidth,
                displayH: imgRef.current.clientHeight,
            };

            // Chỉ cập nhật state nếu kích thước thực sự thay đổi
            setImgSize((prev) => {
                if (
                    prev.naturalW === newSize.naturalW &&
                    prev.naturalH === newSize.naturalH &&
                    prev.displayW === newSize.displayW &&
                    prev.displayH === newSize.displayH
                ) {
                    return prev;
                }
                // Gửi kích thước lên component cha
                onImageLoad(newSize);
                return newSize;
            });
        }
    };

    // === CẬP NHẬT useEffects ===

    // Khi file thay đổi, reset state
    useEffect(() => {
        setDrawingBox(null);
        setStartPos(null);
        setMode("draw_box");
        setPendingKeypointBoxId(null);
        // Tải lại kích thước (quan trọng khi ảnh mới có kích thước khác)
        handleImageLoad();
    }, [file]);

    // useEffect này dùng để scale lại `drawingBox` khi resize cửa sổ
    useEffect(() => {
        // Chỉ scale lại box ĐANG VẼ (nếu có)
        if (!drawingBox || !drawingBox.realW) return;

        const scaleX = imgSize.displayW / imgSize.naturalW;
        const scaleY = imgSize.displayH / imgSize.naturalH;

        setDrawingBox({
            ...drawingBox,
            x: Math.round(drawingBox.realX * scaleX),
            y: Math.round(drawingBox.realY * scaleY),
            w: Math.round(drawingBox.realW * scaleX),
            h: Math.round(drawingBox.realH * scaleY),
        });
    }, [imgSize]);

    // === FIX BUG: Tự động reset mode nếu annotation bị xóa ===
    useEffect(() => {
        if (!pendingKeypointBoxId) return;

        // Kiểm tra xem annotation đang chờ có còn tồn tại không
        const pendingAnnExists = annotations.some(
            (a) => a.id === pendingKeypointBoxId
        );

        // Nếu không (vì đã bị xóa), reset mode
        if (!pendingAnnExists) {
            setMode("draw_box");
            setPendingKeypointBoxId(null);
        }
    }, [annotations, pendingKeypointBoxId]); // Chạy mỗi khi danh sách annotations thay đổi


    // === TÍNH TOÁN HIỂN THỊ ===
    // Chuyển đổi `annotations` (natural) sang `displayAnnotations` (display)
    const displayAnnotations = useMemo((): DisplayAnnotation[] => {
        if (imgSize.naturalW <= 1 || imgSize.naturalH <= 1) return [];

        const scaleX = imgSize.displayW / imgSize.naturalW;
        const scaleY = imgSize.displayH / imgSize.naturalH;

        return annotations.map((ann) => ({
            ...ann,
            displayBox: {
                x: Math.round(ann.box.x * scaleX),
                y: Math.round(ann.box.y * scaleY),
                w: Math.round(ann.box.w * scaleX),
                h: Math.round(ann.box.h * scaleY),
            },
            displayKeypoint: ann.keypoint
                ? {
                    x: Math.round(ann.keypoint.x * scaleX),
                    y: Math.round(ann.keypoint.y * scaleY),
                }
                : null,
        }));
    }, [annotations, imgSize]);

    // Lấy thông tin class (màu sắc) cho annotation
    const getAnnClass = (ann: Annotation) => {
        return CLASSES.find(c => c.id === ann.classId) || CLASSES[0];
    }


    return (
        <>
            {/* Thanh chọn Class */}
            <div className="flex gap-2 p-2 bg-gray-100 rounded items-center">
                <span className="font-medium text-sm text-gray-700">Select Class:</span>
                {CLASSES.map((cls) => (
                    <button
                        key={cls.id}
                        onClick={() => setSelectedClass(cls)}
                        className={`px-3 py-1 text-xs rounded font-semibold ${selectedClass.id === cls.id
                            ? "bg-blue-600 text-white ring-2 ring-blue-300"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                            }`}
                    >
                        {cls.name}
                    </button>
                ))}
            </div>

            {/* Thông báo trạng thái */}
            {mode === 'add_keypoint' && (
                <div className="p-2 text-center bg-blue-100 text-blue-800 rounded border border-blue-300 font-medium">
                    Right-click INSIDE box <strong>{pendingKeypointBoxId?.substring(0, 6)}...</strong> to assign keypoint.
                </div>
            )}


            {/* Container chính */}
            <div
                ref={containerRef}
                className="tool-container relative border border-dashed p-4 rounded h-[90%] bg-gray-100/80"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp} // Hủy vẽ khi ra khỏi container
                onContextMenu={handleContextMenu} // Bắt sự kiện chuột phải
            >
                {!file ? (
                    <div className="p-4 border w-[100%] text-gray-500 text-center">
                        No image selected
                    </div>
                ) : (
                    <div>
                        <p className="mt-2 text-sm text-center truncate flex">
                            {file.name}
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-sm">{`w:${imgSize.naturalW} h:${imgSize.naturalH}`}</span>
                        </p>
                        <div
                            ref={imgWrapperRef}
                            className="relative border w-fit min-w-[80vh] border-gray-300 cursor-crosshair"
                            style={{
                                cursor: mode === "add_keypoint" ? "pointer" : "crosshair"
                            }}
                        >
                            <img
                                ref={imgRef}
                                src={url || ""}
                                alt={file.name}
                                onLoad={handleImageLoad}
                                className="w-full min-h-[100%] max-h-[100%] object-contain rounded pointer-events-none"
                            // draggable={false}
                            />

                            {/* Render TẤT CẢ các annotations đã hoàn thành */}
                            {displayAnnotations.map((ann) => {
                                const annClass = getAnnClass(ann);
                                const isPending = ann.id === pendingKeypointBoxId;
                                return (
                                    <div key={ann.id}>
                                        {/* Bounding Box */}
                                        <div
                                            className={`absolute border-2 ${annClass.color} ${annClass.bg} ${isPending ? 'animate-pulse ring-4 ring-blue-400/50' : ''}`}
                                            style={{
                                                left: ann.displayBox.x,
                                                top: ann.displayBox.y,
                                                width: ann.displayBox.w,
                                                height: ann.displayBox.h,
                                            }}
                                        >
                                            <span className={`absolute -top-5 left-0 ${annClass.color.replace('border', 'text')} text-xs px-1 font-bold bg-white/50 backdrop-blur-sm rounded`}>
                                                {ann.className} {isPending ? '(Awaiting keypoint)' : ''}
                                            </span>
                                        </div>
                                        {/* Keypoint */}
                                        {ann.displayKeypoint && (
                                            <div
                                                className={`absolute w-2.5 h-2.5 rounded-full ${annClass.bg.replace('/20', '/80')} ${annClass.color} border-2`}
                                                style={{
                                                    left: ann.displayKeypoint.x - 5, // Căn giữa
                                                    top: ann.displayKeypoint.y - 5,
                                                }}
                                            ></div>
                                        )}
                                    </div>
                                );
                            })}


                            {/* Render box ĐANG VẼ (drawingBox) */}
                            {drawingBox && (
                                <div
                                    className={`absolute border-2 ${selectedClass.color} ${selectedClass.bg}`}
                                    style={{
                                        left: drawingBox.x,
                                        top: drawingBox.y,
                                        width: drawingBox.w,
                                        height: drawingBox.h,
                                    }}
                                >
                                    <span className="absolute top-0 left-0 bg-black/70 text-white text-xs px-1">
                                        w:{drawingBox.realW}, h:{drawingBox.realH}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
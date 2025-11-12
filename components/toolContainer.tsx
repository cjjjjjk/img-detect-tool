"use client";

import { Annotation, ClassInfo, Keypoint, ImageSize, MaskData } from "@/pages"; // Import kiểu Annotation từ index
import { useEffect, useRef, useState, useMemo } from "react";

interface ToolContainerProps {
    file: File | null;
    onImageLoad: (size: {
        naturalW: number;
        naturalH: number;
        displayW: number;
        displayH: number;
    }) => void;

    // === PROP CHUNG ===
    mode: 'detection' | 'segmentation';

    // === PROPS DETECTION ===
    annotations: Annotation[];
    onAnnotationsChange: (data: Annotation[]) => void;
    classes: ClassInfo[];
    onClassesChange: (newClasses: ClassInfo[]) => void;
    keypointCount: number;
    onKeypointCountChange: (newCount: number) => void;
    onModeChange: (mode: "draw_box" | "add_keypoints") => void;

    // === PROPS SEGMENTATION ===
    imageSize: ImageSize;
    maskData: MaskData | null;
    onMaskChange: (data: MaskData | null) => void;
    // === MỚI: Thêm props cho base mask ===
    baseMask: MaskData | null;
    onBaseMaskChange: (mask: MaskData | null) => void;
}


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
interface DisplayAnnotation extends Annotation {
    displayBox: { x: number; y: number; w: number; h: number };
    displayKeypoints: ({ x: number; y: number } | null)[];
}

// === COMPONENT SEGMENTATION ===
const SegmentationTool = ({
    file,
    imageSize,
    maskData,
    onMaskChange,
    onImageLoad,
    // === MỚI: Nhận props cho base mask ===
    baseMask,
    onBaseMaskChange
}: {
    file: File | null;
    imageSize: ImageSize;
    maskData: MaskData | null;
    onMaskChange: (data: MaskData | null) => void;
    onImageLoad: (size: { naturalW: number; naturalH: number; displayW: number; displayH: number; }) => void;
    // === MỚI: Định nghĩa kiểu props ===
    baseMask: MaskData | null;
    onBaseMaskChange: (mask: MaskData | null) => void;
}) => {
    const [brushSize, setBrushSize] = useState(8);
    const [isPainting, setIsPainting] = useState(false);
    const [paintMode, setPaintMode] = useState<"paint" | "erase">("paint"); // 1 (paint) or 0 (erase)

    const imgRef = useRef<HTMLImageElement | null>(null);
    const paintCanvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas vẽ mask
    const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null); // Ref cho context
    const brushCanvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas cho con trỏ brush
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [displaySize, setDisplaySize] = useState({ w: 1, h: 1 });
    const url = file ? URL.createObjectURL(file) : null;

    // Load ảnh và tính toán kích thước hiển thị
    const handleImageLoad = () => {
        if (imgRef.current) {
            const newDisplaySize = {
                w: imgRef.current.clientWidth,
                h: imgRef.current.clientHeight,
            };
            setDisplaySize(newDisplaySize);

            // Cập nhật kích thước brush canvas ngay lập tức
            const brushCanvas = brushCanvasRef.current;
            if (brushCanvas) {
                brushCanvas.width = newDisplaySize.w;
                brushCanvas.height = newDisplaySize.h;
            }

            // Gọi lại onImageLoad gốc (từ index.tsx)
            onImageLoad({
                naturalW: imgRef.current.naturalWidth,
                naturalH: imgRef.current.naturalHeight,
                displayW: newDisplaySize.w,
                displayH: newDisplaySize.h,
            });
        }
    };

    // === Tách useEffect ===

    // 1. Effect này CHỈ set kích thước (khi ảnh thật thay đổi)
    useEffect(() => {
        const paintCanvas = paintCanvasRef.current;
        if (paintCanvas && imageSize.naturalW > 1 && imageSize.naturalH > 1) {
            // Cập nhật kích thước canvas (natural)
            paintCanvas.width = imageSize.naturalW;
            paintCanvas.height = imageSize.naturalH;

            // Lấy context MỘT LẦN và set 'willReadFrequently'
            const ctx = paintCanvas.getContext('2d', {
                willReadFrequently: true
            });
            paintCtxRef.current = ctx; // Lưu context vào ref
        }
    }, [imageSize.naturalW, imageSize.naturalH]); // CHỈ chạy khi kích thước thật thay đổi

    // 2. Effect này CHỈ load data (khi file hoặc mask prop thay đổi)
    useEffect(() => {
        const ctx = paintCtxRef.current;
        if (!ctx || imageSize.naturalW <= 1) return; // Nếu context chưa sẵn sàng (ảnh chưa load)

        // Xóa canvas trước khi vẽ
        ctx.clearRect(0, 0, imageSize.naturalW, imageSize.naturalH);

        if (maskData) {
            // Logic load mask data (maskData là ImageData kênh Alpha)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageSize.naturalW;
            tempCanvas.height = imageSize.naturalH;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.putImageData(maskData, 0, 0);

                // Chuyển mask (kênh Alpha) thành màu trắng
                tempCtx.globalCompositeOperation = 'source-in';
                tempCtx.fillStyle = 'white';
                tempCtx.fillRect(0, 0, imageSize.naturalW, imageSize.naturalH);

                // Vẽ lên canvas chính
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(tempCanvas, 0, 0);
            }
        }
        // Nếu không có maskData (ví dụ, mask là null), canvas đã được xóa (full trong suốt)

    }, [maskData, file, imageSize.naturalW]); // Chạy khi mask (prop) hoặc file thay đổi


    // ===================================

    const getCoords = (e: React.MouseEvent): { x: number, y: number } | null => {
        if (!containerRef.current || !imgRef.current || displaySize.w <= 1 || displaySize.h <= 1) return null;

        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = imageSize.naturalW / displaySize.w;
        const scaleY = imageSize.naturalH / displaySize.h;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        return { x: Math.round(x), y: Math.round(y) };
    };

    const drawOnCanvas = (x: number, y: number) => {
        const ctx = paintCtxRef.current;
        if (!ctx) return;

        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, 2 * Math.PI, true);

        if (paintMode === 'paint') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'white'; // Vẽ màu trắng (sẽ được chuyển thành Alpha khi lưu)
            ctx.fill();
        } else {
            ctx.globalCompositeOperation = 'destination-out'; // Tẩy
            ctx.fill();
        }
        ctx.closePath(); // Đóng path lại
    };

    const drawBrushCursor = (e: React.MouseEvent) => {
        const brushCtx = brushCanvasRef.current?.getContext('2d');
        if (!brushCtx || !containerRef.current || displaySize.w <= 1 || imageSize.naturalW <= 1) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        brushCtx.clearRect(0, 0, brushCtx.canvas.width, brushCtx.canvas.height);
        brushCtx.beginPath();

        const displayBrushSize = brushSize * (displaySize.w / imageSize.naturalW);
        brushCtx.arc(x, y, displayBrushSize > 1 ? displayBrushSize : 1, 0, 2 * Math.PI);

        brushCtx.strokeStyle = 'white';

        brushCtx.lineWidth = 1;
        brushCtx.stroke();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) setPaintMode('paint');
        else if (e.button === 2) setPaintMode('erase');
        else return;

        e.preventDefault();
        setIsPainting(true);
        const coords = getCoords(e);
        if (coords) drawOnCanvas(coords.x, coords.y);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        drawBrushCursor(e);

        if (!isPainting) {
            return
        };

        e.preventDefault();
        const coords = getCoords(e);

        if (coords) drawOnCanvas(coords.x, coords.y);
    };

    // === CẬP NHẬT: Hàm lưu (mouseUp / mouseLeave) ===
    const saveMask = () => {
        if (!isPainting) return; // Chỉ lưu nếu đang vẽ
        setIsPainting(false);

        const ctx = paintCtxRef.current;
        if (!ctx || !paintCanvasRef.current) return;

        // Lấy dữ liệu từ canvas (đang là màu trắng/trong suốt)
        const canvasData = ctx.getImageData(0, 0, paintCanvasRef.current.width, paintCanvasRef.current.height);

        // Tạo ImageData mới để lưu mask (chỉ dùng kênh Alpha)
        const newMask = new ImageData(paintCanvasRef.current.width, paintCanvasRef.current.height);
        for (let i = 0; i < canvasData.data.length; i += 4) {
            // Nếu Alpha > 0 (vùng được vẽ)
            if (canvasData.data[i + 3] > 0) {
                // Đặt R,G,B,A thành 255 (để tương thích với logic load)
                newMask.data[i] = 255;
                newMask.data[i + 1] = 255;
                newMask.data[i + 2] = 255;
                newMask.data[i + 3] = 255;
            } else {
                // Mặc định là 0, 0, 0, 0 (trong suốt)
            }
        }
        onMaskChange(newMask);
    };


    const handleMouseUp = (e: React.MouseEvent) => {
        e.preventDefault();
        saveMask();
    };

    const handleMouseLeave = () => {
        const brushCtx = brushCanvasRef.current?.getContext('2d');
        if (brushCtx) {
            brushCtx.clearRect(0, 0, brushCtx.canvas.width, brushCtx.canvas.height);
        }
        // Dừng vẽ và lưu
        saveMask();
    };

    const handleBaseMaskToggle = () => {
        if (baseMask) {
            // Nếu đang có base mask -> Xóa nó
            if (confirm("Bạn có chắc muốn xóa base mask?")) {
                onBaseMaskChange(null);
            }
        } else {
            // Nếu không có base mask -> Lưu mask hiện tại làm base mask
            if (maskData && maskData.data.some(val => val > 0)) {
                // Tạo một bản sao của maskData để tránh bị sửa đổi
                const newBaseMask = new ImageData(
                    new Uint8ClampedArray(maskData.data),
                    maskData.width,
                    maskData.height
                );
                onBaseMaskChange(newBaseMask);
                alert("Đã lưu base mask.");
            } else {
                alert("Không thể lưu một mask rỗng làm base mask.");
            }
        }
    };


    return (
        <>
            <div className="flex justify-between items-center flex-wrap gap-4 p-2 bg-gray-100 rounded">
                <div className="flex gap-2 items-center">
                    <span className="font-medium text-sm text-gray-700">Brush Size:</span>
                    <input
                        type="range"
                        min="4"
                        max="32"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-32"
                    />
                    <input
                        type="number"
                        min="4"
                        max="32"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        disabled
                        className="w-16 px-2 py-1 text-sm border rounded text-black"
                    />
                </div>

                <div className="flex gap-2 items-center">
                    <button
                        onClick={handleBaseMaskToggle}
                        className={`px-3 py-1 text-sm rounded font-semibold transition-colors ${baseMask
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                    >
                        {baseMask ? "Base mask" : "Save base mask"}
                    </button>
                </div>
            </div>

            <div
                className="tool-container relative border border-dashed p-4 rounded h-[90%] bg-gray-100/80"
                onContextMenu={(e) => e.preventDefault()}
            >
                {!file ? (
                    <div className="p-4 border border-dashed font-bold w-[100%] text-gray-500 text-center">
                        no image selected
                    </div>
                ) : (
                    <div>
                        <p className="mt-2 text-black text-sm text-center truncate flex">
                            {file.name}
                            <span className="absolute top-1 left-4 bg-red-800 text-white text-xs px-2 py-0.5">{`w:${imageSize.naturalW} h:${imageSize.naturalH}`}</span>
                        </p>
                        <div
                            ref={containerRef}
                            className="relative border w-fit min-w-[80vh] border-gray-300"
                            style={{ cursor: "none" }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                        >
                            <img
                                ref={imgRef}
                                src={url || ""}
                                alt={file.name}
                                onLoad={handleImageLoad}
                                className="w-full min-h-[100%] max-h-[100%] object-contain rounded pointer-events-none"
                            />
                            {/* Canvas vẽ mask (hiển thị đè) */}
                            <canvas
                                ref={paintCanvasRef}
                                className="absolute top-0 left-0 w-full h-full opacity-50 pointer-events-none"
                                style={{ imageRendering: 'pixelated' }}
                            />
                            {/* Canvas cho con trỏ brush */}
                            <canvas
                                ref={brushCanvasRef}
                                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};


// === COMPONENT CHÍNH (ĐIỀU HƯỚNG) ===
export default function ToolContainer(props: ToolContainerProps) {

    // === RENDER CÓ ĐIỀU KIỆN (CẬP NHẬT PROPS) ===
    if (props.mode === 'segmentation') {
        return <SegmentationTool
            file={props.file}
            imageSize={props.imageSize}
            maskData={props.maskData}
            onMaskChange={props.onMaskChange}
            onImageLoad={props.onImageLoad}
            // === MỚI: Truyền props ===
            baseMask={props.baseMask}
            onBaseMaskChange={props.onBaseMaskChange}
        />;
    }

    // === LOGIC CŨ CHO DETECTION (Giữ nguyên toàn bộ) ===
    const {
        file,
        annotations,
        onAnnotationsChange,
        onImageLoad,
        classes,
        onClassesChange,
        keypointCount,
        onKeypointCountChange,
        onModeChange,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const imgWrapperRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
        null
    );
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

    // === CẬP NHẬT STATE ===
    // State cho chế độ: 'draw_box' (vẽ hộp) hoặc 'add_keypoints' (thêm nhiều điểm)
    const [mode, setMode] = useState<"draw_box" | "add_keypoints">("draw_box");
    // State cho class đang được chọn
    const [selectedClass, setSelectedClass] = useState(classes[0]);
    // State cho ID của box đang chờ gán keypoint
    const [pendingKeypointBoxId, setPendingKeypointBoxId] = useState<string | null>(
        null
    );
    // === STATE MỚI: Theo dõi keypoint đang gán ===
    const [currentKeypointIndex, setCurrentKeypointIndex] = useState(0);

    const url = file ? URL.createObjectURL(file) : null;

    // Hàm helper để gọi setMode và onModeChange
    const updateMode = (newMode: "draw_box" | "add_keypoints") => {
        setMode(newMode);
        onModeChange(newMode);
    };

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
        if (!file || !imgWrapperRef.current || mode !== "draw_box" || e.button !== 0 || !selectedClass) {
            return;
        }
        const { x, y } = clampToWrapper(e.clientX, e.clientY);
        setStartPos({ x, y });
        setDrawingBox({
            x, y, w: 0, h: 0,
            realX: 0, realY: 0, realW: 0, realH: 0,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
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
            x, y, w, h,
            realX: Math.round(x * scaleX),
            realY: Math.round(y * scaleY),
            realW: Math.round(w * scaleX),
            realH: Math.round(h * scaleY),
        });
    };

    // === LOGIC MỚI: Xử lý thả chuột (Hoàn thành vẽ box) ===
    const handleMouseUp = () => {
        if (startPos && drawingBox && file && selectedClass) { // Đảm bảo đã chọn class
            if (drawingBox.w < 5 || drawingBox.h < 5) {
                setDrawingBox(null);
                setStartPos(null);
                return;
            }

            const realX = Math.min(drawingBox.realX, drawingBox.realX + drawingBox.realW);
            const realY = Math.min(drawingBox.realY, drawingBox.realY + drawingBox.realH);
            const realW = Math.abs(drawingBox.realW);
            const realH = Math.abs(drawingBox.realH);

            // Tạo annotation mới
            const newAnnotation: Annotation = {
                id: crypto.randomUUID(),
                classId: selectedClass.id,
                className: selectedClass.name,
                box: { x: realX, y: realY, w: realW, h: realH },
                keypoints: Array(keypointCount).fill(null), // <-- MỚI: Khởi tạo mảng KPT
            };

            onAnnotationsChange([...annotations, newAnnotation]);

            // === MỚI: Quyết định chế độ tiếp theo ===
            if (keypointCount > 0) {
                // Nếu cần KPT, chuyển sang chế độ gán KPT
                updateMode("add_keypoints"); // <-- CẬP NHẬT
                setPendingKeypointBoxId(newAnnotation.id);
                setCurrentKeypointIndex(0); // Bắt đầu từ KPT đầu tiên
            } else {
                // Nếu không cần KPT (keypointCount = 0), giữ nguyên chế độ 'draw_box'
                updateMode("draw_box"); // <-- CẬP NHẬT
            }
        }
        setDrawingBox(null);
        setStartPos(null);
    };

    // === LOGIC MỚI: Xử lý chuột phải (Gán N keypoints) ===
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();

        // Chỉ hoạt động khi có file và đang ở chế độ 'add_keypoints'
        if (!file || mode !== "add_keypoints" || !pendingKeypointBoxId) return;

        const annToUpdate = annotations.find((a) => a.id === pendingKeypointBoxId);
        if (!annToUpdate) return;

        const { x, y } = clampToWrapper(e.clientX, e.clientY);
        const scaleX = imgSize.naturalW / imgSize.displayW;
        const scaleY = imgSize.naturalH / imgSize.displayH;
        const kptX = Math.round(x * scaleX);
        const kptY = Math.round(y * scaleY);

        const box = annToUpdate.box;
        if (
            kptX >= box.x &&
            kptX <= box.x + box.w &&
            kptY >= box.y &&
            kptY <= box.y + box.h
        ) {
            // Cập nhật keypoint tại vị trí index hiện tại
            const newKeypoints = [...annToUpdate.keypoints];
            newKeypoints[currentKeypointIndex] = { x: kptX, y: kptY };

            const updatedAnns = annotations.map((a) =>
                a.id === pendingKeypointBoxId
                    ? { ...a, keypoints: newKeypoints }
                    : a
            );
            onAnnotationsChange(updatedAnns);

            // === MỚI: Kiểm tra xem có cần gán KPT tiếp theo không ===
            if (currentKeypointIndex < keypointCount - 1) {
                // Nếu còn KPT, tăng index
                setCurrentKeypointIndex(currentKeypointIndex + 1);
            } else {
                // Nếu đã gán KPT cuối cùng, reset
                updateMode("draw_box"); // <-- CẬP NHẬT
                setPendingKeypointBoxId(null);
                setCurrentKeypointIndex(0);
            }
        } else {
            alert("Keypoint must be inside the bounding box. Please try again.");
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
            setImgSize((prev) => {
                if (
                    prev.naturalW === newSize.naturalW &&
                    prev.naturalH === newSize.naturalH &&
                    prev.displayW === newSize.displayW &&
                    prev.displayH === newSize.displayH
                ) {
                    return prev;
                }
                onImageLoad(newSize);
                return newSize;
            });
        }
    };

    // === CẬP NHẬT useEffects ===

    useEffect(() => {
        setDrawingBox(null);
        setStartPos(null);
        updateMode("draw_box"); // <-- CẬP NHẬT
        setPendingKeypointBoxId(null);
        setCurrentKeypointIndex(0); // <-- MỚI

        // Đảm bảo selectedClass vẫn hợp lệ sau khi classes thay đổi
        if (classes.length > 0) {
            // @ts-ignore
            const currentSelectedExists = classes.find(c => c.id === selectedClass?.id);
            if (!currentSelectedExists) {
                setSelectedClass(classes[0]); // Chọn class đầu tiên nếu class cũ bị xóa
            } else {
                // Cập nhật selectedClass nếu tên thay đổi
                setSelectedClass(currentSelectedExists);
            }
        } else {
            // @ts-ignore
            setSelectedClass(null); // Không có class nào
        }

        handleImageLoad();
    }, [file, classes]); // Phụ thuộc vào classes

    useEffect(() => {
        if (!drawingBox || !drawingBox.realW || imgSize.naturalW <= 1) return;
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

    useEffect(() => {
        if (!pendingKeypointBoxId) return;
        const pendingAnnExists = annotations.some((a) => a.id === pendingKeypointBoxId);
        if (!pendingAnnExists) {
            updateMode("draw_box"); // <-- CẬP NHẬT
            setPendingKeypointBoxId(null);
            setCurrentKeypointIndex(0); // <-- MỚI
        }
    }, [annotations, pendingKeypointBoxId]);

    // === MỚI: Xử lý "Space" để Skip Keypoint ===
    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            // Chỉ kích hoạt khi đang ở chế độ add_keypoints và nhấn Space (không có Ctrl)
            if (mode !== "add_keypoints" || e.code !== "Space" || e.ctrlKey || !pendingKeypointBoxId) {
                return;
            }

            e.preventDefault(); // Ngăn cuộn trang (và ngăn index.tsx bắt)

            const annToUpdate = annotations.find((a) => a.id === pendingKeypointBoxId);
            if (!annToUpdate) return;

            // Gán keypoint hiện tại là null (skip)
            const newKeypoints = [...annToUpdate.keypoints];
            newKeypoints[currentKeypointIndex] = null; // Gán là null

            const updatedAnns = annotations.map((a) =>
                a.id === pendingKeypointBoxId
                    ? { ...a, keypoints: newKeypoints }
                    : a
            );
            onAnnotationsChange(updatedAnns);

            // Chuyển sang keypoint tiếp theo hoặc kết thúc
            if (currentKeypointIndex < keypointCount - 1) {
                setCurrentKeypointIndex(currentKeypointIndex + 1);
            } else {
                updateMode("draw_box"); // <-- CẬP NHẬT
                setPendingKeypointBoxId(null);
                setCurrentKeypointIndex(0);
            }
        };

        window.addEventListener("keydown", handleKeydown);
        return () => {
            window.removeEventListener("keydown", handleKeydown);
        };
    }, [mode, pendingKeypointBoxId, currentKeypointIndex, keypointCount, annotations, onAnnotationsChange]); // Thêm dependencies


    // === TÍNH TOÁN HIỂN THỊ ===
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
            // Scale tất cả keypoints
            displayKeypoints: ann.keypoints.map(kpt =>
                kpt
                    ? {
                        x: Math.round(kpt.x * scaleX),
                        y: Math.round(kpt.y * scaleY),
                    }
                    : null
            ),
        }));
    }, [annotations, imgSize]);

    const getAnnClass = (ann: Annotation) => {
        return classes.find((c) => c.id === ann.classId) || classes[0];
    };

    // === CẬP NHẬT: Xử lý Class (Sửa lỗi ID) ===
    const handleAddClass = () => {
        // SỬA LỖI: Tìm ID số lớn nhất và +1
        const maxId = classes.reduce((max, cls) => Math.max(max, cls.id), -1);
        const newId = maxId + 1; // ID mới sẽ là 0, 1, 2, ...

        const newClass: ClassInfo = {
            id: newId, // Gán ID số
            name: `c_${newId}`, // Tên mặc định
            color: "border-gray-500", // Màu mặc định
            bg: "bg-gray-500/20",
        };
        onClassesChange([...classes, newClass]);
    };

    // === CẬP NHẬT: Xử lý Class (Sửa lỗi type) ===
    const handleClassNameChange = (id: number, newName: string) => { // Thay id: string -> id: number
        const updatedClasses = classes.map(cls =>
            cls.id === id ? { ...cls, name: newName } : cls // Bỏ Number()
        );
        onClassesChange(updatedClasses);
    };

    // === MỚI: Xử lý Xóa Class (Chuột phải) ===
    const handleDeleteClass = (idToDelete: number) => {
        const classToDelete = classes.find(c => c.id === idToDelete);
        if (!classToDelete) return;

        if (confirm(`Are you sure you want to delete class "${classToDelete.name}" (ID: ${classToDelete.id})?`)) {
            const updatedClasses = classes.filter(cls => cls.id !== idToDelete);
            onClassesChange(updatedClasses);
            // useEffect sẽ tự động xử lý nếu class bị xóa là class đang được chọn
        }
    };

    // Đảm bảo selectedClass luôn hợp lệ
    useEffect(() => {
        if (classes.length > 0 && !classes.find(c => c.id === selectedClass?.id)) {
            setSelectedClass(classes[0]);
        } else if (classes.length === 0) {
            // @ts-ignore
            setSelectedClass(null); // Xử lý trường hợp không có class nào
        }
    }, [classes, selectedClass]);


    return (
        <>
            {/* Thanh chọn Class và Keypoint (UI MỚI) */}
            <div className="flex justify-between items-center flex-wrap gap-4 p-2 bg-gray-100 rounded">

                {/* Khu vực Classes (Bên trái) */}
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="font-medium text-sm text-gray-700">Classes:</span>
                    {classes.map((cls) => (
                        // === CẬP NHẬT: Thêm onContextMenu để Xóa ===
                        <div
                            key={cls.id}
                            className={`flex items-center rounded ${selectedClass?.id === cls.id ? 'ring-2 ring-blue-500' : ''}`}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                handleDeleteClass(cls.id);
                            }}
                        >
                            <button
                                onClick={() => setSelectedClass(cls)} // Chuột trái: Chọn
                                className={`px-2 py-1 text-xs rounded-l font-semibold ${selectedClass?.id === cls.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                    }`}
                            >
                                {cls.id} {/* SỬA LỖI: Hiển thị ID số */}
                            </button>
                            <input
                                type="text"
                                value={cls.name}
                                // === CẬP NHẬT: Sửa lỗi type (truyền cls.id (number)) ===
                                onChange={(e) => handleClassNameChange(cls.id, e.target.value)}
                                className="px-2 py-1 text-xs w-20 rounded-r border-l border-gray-400 text-black"
                                placeholder="Class Name"
                            />
                        </div>
                    ))}
                    <button
                        onClick={handleAddClass}
                        className="px-3 py-1 text-xs rounded font-semibold bg-green-500 text-white hover:bg-green-600"
                    >
                        + Class
                    </button>
                </div>

                {/* Khu vực Keypoints (Bên phải) */}
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="font-medium text-sm text-gray-700">Keypoints:</span>
                    <div className="flex gap-1 items-center">
                        {Array.from({ length: keypointCount }).map((_, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs font-mono bg-gray-300 rounded">
                                [{i + 1}]
                            </span>
                        ))}
                        {keypointCount === 0 && <span className="text-xs text-gray-500">no kpts</span>}
                    </div>

                    {keypointCount > 0 && (
                        <button
                            onClick={() => onKeypointCountChange(Math.max(0, keypointCount - 1))}
                            className="px-3 py-1 text-xs rounded font-semibold bg-red-500 text-white hover:bg-red-600"
                        >
                            [X]
                        </button>
                    )}

                    <button
                        onClick={() => onKeypointCountChange(keypointCount + 1)}
                        className="px-3 py-1 text-xs rounded font-semibold bg-blue-500 text-white hover:bg-blue-600"
                    >
                        + Add Kpt
                    </button>
                </div>
            </div>


            {/* Container chính */}
            <div
                ref={containerRef}
                className="tool-container relative border border-dashed p-4 rounded h-[90%] bg-gray-100/80"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
            >
                {!file ? (
                    <div className="p-4 border border-dashed font-bold w-[100%] text-gray-500 text-center">
                        no image selected
                    </div>
                ) : !selectedClass ? ( // MỚI: Kiểm tra nếu không có class nào
                    <div className="p-4 border border-dashed font-bold w-[100%] text-red-500 text-center">
                        Please add at least one class to start labeling.
                    </div>
                ) : (
                    <div>
                        <p className="mt-2 text-black text-sm text-center truncate flex">
                            {file.name}
                            <span className="absolute top-1 left-4 bg-red-800 text-white text-xs px-2 py-0.5">{`w:${imgSize.naturalW} h:${imgSize.naturalH}`}</span>
                        </p>
                        <div
                            ref={imgWrapperRef}
                            className="relative border w-fit min-w-[80vh] border-gray-300"
                            style={{
                                cursor: mode === "add_keypoints" ? "pointer" : "crosshair"
                            }}
                        >
                            <img
                                ref={imgRef}
                                src={url || ""}
                                alt={file.name}
                                onLoad={handleImageLoad}
                                className="w-full min-h-[100%] max-h-[100%] object-contain rounded pointer-events-none"
                            />

                            {/* Render TẤT CẢ các annotations đã hoàn thành */}
                            {displayAnnotations.map((ann, index) => {
                                const annClass = getAnnClass(ann);
                                if (!annClass) return null; // Bỏ qua nếu class không tồn tại
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
                                            <span className={`absolute top-0 left-0 ${annClass.color.replace('border', 'text')} text-[8px] font-bold px-1 whitespace-nowrap text-white bg-red-600/60 backdrop-blur-sm`}>
                                                [{index + 1}] {ann.className} {isPending ? `▶ Kpt ${currentKeypointIndex + 1}` : ''}
                                            </span>
                                        </div>

                                        {/* CẬP NHẬT: Render tất cả Keypoints */}
                                        {ann.displayKeypoints.map((kpt, idx) =>
                                            kpt && (
                                                <div
                                                    key={idx}
                                                    className={`absolute w-4 h-4 rounded-full ${annClass.bg.replace('/20', '/80')} ${annClass.color} border-2 flex items-center justify-center`}
                                                    style={{
                                                        left: kpt.x - 8, // Căn giữa
                                                        top: kpt.y - 8,
                                                    }}
                                                >
                                                    <span className="text-xs font-bold" style={{ color: annClass.color.replace('border', 'text') }}>{idx + 1}</span>
                                                </div>
                                            )
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

            {mode === 'add_keypoints' && (
                <div className="p-2 text-center bg-blue-100 text-blue-800 rounded border border-blue-300 font-medium">
                    Right-click INSIDE box <strong>{pendingKeypointBoxId?.substring(0, 6)}...</strong> to assign keypoint <strong>{currentKeypointIndex + 1}/{keypointCount}</strong>. (Press Space to skip)
                </div>
            )}
        </>
    );
}
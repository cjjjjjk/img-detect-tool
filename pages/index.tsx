"use client";
import { useState, useRef, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import InputContainer, { InputContainerHandle } from "@/components/inputContainer";
import OutputContainer from "@/components/ouputContainer";
import ToolContainer from "@/components/toolContainer"; // Giữ nguyên

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Định nghĩa kiểu dữ liệu gán nhãn (Detection)
export interface Keypoint {
  x: number; // natural x
  y: number; // natural y
}

export interface Annotation {
  id: string;
  classId: number;
  className: string;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  keypoints: (Keypoint | null)[];
}

// Kích thước ảnh
export interface ImageSize {
  naturalW: number;
  naturalH: number;
}

// Định nghĩa các lớp (class)
const INITIAL_CLASSES = [
  { id: 0, name: "car", color: "border-red-500", bg: "bg-red-500/20" },
  { id: 1, name: "bus", color: "border-blue-500", bg: "bg-blue-500/20" },
  { id: 2, name: "truck", color: "border-green-500", bg: "bg-green-500/20" },
  { id: 3, name: "motorcycle", color: "border-yellow-500", bg: "bg-yellow-500/20" },
];
export type ClassInfo = typeof INITIAL_CLASSES[0];

// === KIỂU DỮ LIỆU MỚI CHO SEGMENTATION ===
// Dữ liệu mask (1: vùng chọn, 0: nền)
// Chúng ta sẽ dùng ImageData để lưu trữ hiệu quả (W x H x 4 [R,G,B,A])
// Chúng ta sẽ sử dụng kênh Alpha (A) để lưu mask: 255 = 1 (vùng chọn), 0 = 0 (nền)
export type MaskData = ImageData;


export default function Home() {
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(500);
  const [draggingRight, setDraggingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // handle drag (Không thay đổi)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRight && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        if (newWidth > 250 && newWidth < 800) {
          setRightWidth(newWidth);
        }
      }
    };
    const stopDragging = () => setDraggingRight(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("mouseleave", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("mouseleave", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, [draggingRight]);

  // === CẬP NHẬT LOGIC STATE ===

  // file handling
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [allFiles, setAllFiles] = useState<File[]>([]);

  // State kích thước ảnh
  const [imgNaturalSize, setImgNaturalSize] = useState<ImageSize>({
    naturalW: 1,
    naturalH: 1,
  });

  // === STATE MỚI: Quản lý chế độ ===
  const [mode, setMode] = useState<'detection' | 'segmentation'>('detection');

  // --- State cho Detection (Như cũ) ---
  const [allAnnotations, setAllAnnotations] = useState<Map<string, Annotation[]>>(
    new Map()
  );
  const [classes, setClasses] = useState<ClassInfo[]>(INITIAL_CLASSES);
  const [keypointCount, setKeypointCount] = useState<number>(0);
  const [highlightSkip, setHighlightSkip] = useState(false);
  const toolModeRef = useRef<"draw_box" | "add_keypoints">("draw_box");

  // --- STATE MỚI: Cho Segmentation ---
  const [allMasks, setAllMasks] = useState<Map<string, MaskData | null>>(new Map());


  // Lấy dữ liệu cho ảnh đang chọn
  const currentAnnotations =
    allAnnotations.get(selectedImage?.name || "") || [];
  const currentMask =
    allMasks.get(selectedImage?.name || "") || null;


  // === CÁC HÀM CẬP NHẬT ===

  // Cập nhật nhãn (Detection)
  const handleSingleFileAnnotationsChange = (newAnns: Annotation[]) => {
    if (!selectedImage) return;
    const newMap = new Map(allAnnotations);
    newMap.set(selectedImage.name, newAnns);
    setAllAnnotations(newMap);
  };

  // Cập nhật (Detection import)
  const handleBulkAnnotationsUpdate = (newAnnotationsMap: Map<string, Annotation[]>) => {
    setAllAnnotations(new Map([...allAnnotations, ...newAnnotationsMap]));
  };

  // Cập nhật class (Detection)
  const handleClassesChange = (newClasses: ClassInfo[]) => {
    setClasses(newClasses);
  };

  // Cập nhật KPT (Detection)
  const handleKeypointCountChange = (newCount: number) => {
    if (newCount === keypointCount) return;
    setKeypointCount(newCount);
    setAllAnnotations(new Map());

    if (newCount > keypointCount && newCount > 0) {
      setHighlightSkip(true);
      setTimeout(() => setHighlightSkip(false), 2000);
    }
  };

  // Cập nhật kích thước ảnh (Cho cả 2 mode)
  const handleImageLoad = (size: {
    naturalW: number;
    naturalH: number;
    displayW: number;
    displayH: number;
  }) => {
    if (size.naturalW > 1 && size.naturalH > 1) {
      const newSize = {
        naturalW: size.naturalW,
        naturalH: size.naturalH,
      };
      setImgNaturalSize(newSize);

      // MỚI: Nếu là chế độ segmentation và chưa có mask, tạo mask mặc định
      if (mode === 'segmentation' && selectedImage) {
        setAllMasks(prevMasks => {
          const currentMask = prevMasks.get(selectedImage.name);
          // Chỉ tạo nếu chưa tồn tại
          if (!currentMask) {
            // Tạo mask đen (full 0)
            const newMaskData = new ImageData(size.naturalW, size.naturalH);
            const newMap = new Map(prevMasks);
            newMap.set(selectedImage.name, newMaskData);
            return newMap;
          }
          // Nếu mask đã tồn tại (ví dụ, từ lần load trước), kiểm tra kích thước
          else if (currentMask.width !== size.naturalW || currentMask.height !== size.naturalH) {
            // Kích thước thay đổi (lạ), tạo lại mask
            const newMaskData = new ImageData(size.naturalW, size.naturalH);
            const newMap = new Map(prevMasks);
            newMap.set(selectedImage.name, newMaskData);
            return newMap;
          }
          return prevMasks;
        });
      }
    }
  };

  // Callback (Detection)
  const handleModeChange = (mode: "draw_box" | "add_keypoints") => {
    toolModeRef.current = mode;
  };

  // === HÀM MỚI: Cập nhật Mask (Segmentation) ===
  const handleMaskChange = (newMaskData: MaskData | null) => {
    if (!selectedImage) return;
    const newMap = new Map(allMasks);
    newMap.set(selectedImage.name, newMaskData);
    setAllMasks(newMap);
  };

  // === HÀM MỚI: Xử lý khi chọn ảnh ===
  const handleSelectImage = (file: File | null) => {
    setSelectedImage(file);
    // Khi đổi ảnh, nếu là mode segmentation, cần tạo mask ngay
    if (file && mode === 'segmentation' && imgNaturalSize.naturalW > 1 && imgNaturalSize.naturalH > 1) {
      // (handleImageLoad sẽ xử lý việc tạo mask nếu nó chưa tồn tại)
      // Chúng ta có thể gọi lại handleImageLoad nếu cần, 
      // nhưng logic tốt hơn là đợi handleImageLoad tự nhiên
    }
  }


  // events (Xử lý xung đột phím Space)
  const inputRef = useRef<InputContainerHandle>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      // page control
      if (e.code === "Space" && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.nextImage();
      }

      if (e.code === "Space" && e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.prevImage();
      }

      if (mode === 'segmentation') {
        return;
      }

      if (toolModeRef.current === "add_keypoints") {
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]); // MỚI: Thêm 'mode' vào dependency

  return (
    <div
      ref={containerRef}
      className={`${geistSans.className} ${geistMono.className} font-sans flex h-screen bg-gray-100`}
    >
      {/* Left panel (Cập nhật props) */}
      <div
        style={{ width: leftWidth }}
        className="bg-gray-200 transition-all duration-300 flex flex-col shadow-lg"
      >
        <button
          onClick={() => setLeftWidth(leftWidth === 100 ? 300 : 100)}
          className="p-2 bg-gray-600 text-white font-bold hover:bg-gray-700"
        >
          {leftWidth === 100 ? ">>" : "<<"}
        </button>
        {leftWidth > 0 && (
          <div className="p-2 flex-1">
            <InputContainer
              ref={inputRef}
              onFileSelect={handleSelectImage} // CẬP NHẬT
              onFilesChange={setAllFiles}
              isWidthCollapsed={leftWidth === 100}
              // === PROPS MỚI ===
              mode={mode}
              onModeChange={setMode}
            />
          </div>
        )}
      </div>

      {/* Middle panel (Cập nhật props cho ToolContainer) */}
      <div className="flex-1 bg-white p-2 flex flex-col gap-2">
        <ToolContainer
          file={selectedImage}
          onImageLoad={handleImageLoad}

          // === PROPS CHUNG ===
          mode={mode}

          // === PROPS CHO DETECTION ===
          annotations={currentAnnotations}
          onAnnotationsChange={handleSingleFileAnnotationsChange}
          classes={classes}
          onClassesChange={handleClassesChange}
          keypointCount={keypointCount}
          onKeypointCountChange={handleKeypointCountChange}
          onModeChange={handleModeChange}

          // === PROPS MỚI CHO SEGMENTATION ===
          imageSize={imgNaturalSize}
          maskData={currentMask}
          onMaskChange={handleMaskChange}
        />

        {/* Hotkeys (Render có điều kiện) */}
        {mode === 'detection' ? (
          <div className="mt-2 p-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-700 shadow-sm">
            <div className="flex flex-col items-start gap-2">
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Space</kbd>:
                Next Image
              </span>
              <span className={`flex items-center gap-2 rounded py-1 pr-2 transition-all duration-100 ${highlightSkip ? 'flash-yellow' : 'bg-transparent'}`}>
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Space (add kpt)</kbd>:
                Skip current Keypoint
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Ctrl + Space</kbd>:
                Previous Image
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Left-click Drag</kbd>:
                Draw Bounding Box
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Right-click</kbd>:
                Assign Keypoint(s) (after drawing box)
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Right-click [classID]</kbd>:
                Delete class
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 p-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-700 shadow-sm">
            <div className="flex flex-col items-start gap-2">
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Space</kbd>:
                Next Image
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Ctrl + Space</kbd>:
                Previous Image
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Left-click Drag</kbd>:
                Paint Mask
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Right-click Drag</kbd>:
                Erase Mask
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel (Cập nhật props cho OutputContainer) */}
      <div style={{ width: rightWidth }} className="relative bg-gray-200 shadow-inner">
        <div className="p-2">
          <OutputContainer
            imageName={selectedImage?.name || ""}
            imageSize={imgNaturalSize}

            // === PROPS CHUNG ===
            mode={mode}

            // === PROPS CHO DETECTION ===
            annotations={currentAnnotations}
            onAnnotationsChange={handleSingleFileAnnotationsChange}
            classes={classes}
            allImageFiles={allFiles}
            onBulkAnnotationsUpdate={handleBulkAnnotationsUpdate}
            keypointCount={keypointCount}

            // === PROPS MỚI CHO SEGMENTATION ===
            maskData={currentMask}
          />
        </div>
        {/* Drag handle (Không thay đổi) */}
        <div
          onMouseDown={() => setDraggingRight(true)}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors duration-200"
        />
      </div>
    </div>
  );
}
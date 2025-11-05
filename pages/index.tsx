"use client";
import { useState, useRef, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import InputContainer, { InputContainerHandle } from "@/components/inputContainer";
import OutputContainer from "@/components/ouputContainer";
import ToolContainer from "@/components/toolContainer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Định nghĩa kiểu dữ liệu gán nhãn mới
export interface Keypoint {
  x: number; // natural x
  y: number; // natural y
}

// === CẬP NHẬT INTERFACE ===
export interface Annotation {
  id: string; // ID duy nhất để xóa
  classId: number; // ID lớp YOLO
  className: string; // Tên lớp, vd: "car"
  box: {
    // Tọa độ natural
    x: number; // top-left x
    y: number; // top-left y
    w: number;
    h: number;
  };
  keypoints: (Keypoint | null)[]; // <-- THAY ĐỔI: Từ 1 keypoint thành mảng keypoint
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


export default function Home() {
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(500);
  const [draggingRight, setDraggingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // handle drag for right panel (Không thay đổi)
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
  const [allFiles, setAllFiles] = useState<File[]>([]); // Lưu trữ tất cả file

  // State mới: Lưu trữ kích thước natural của ảnh
  const [imgNaturalSize, setImgNaturalSize] = useState<ImageSize>({
    naturalW: 1,
    naturalH: 1,
  });

  // State mới: Lưu trữ TẤT CẢ các nhãn
  const [allAnnotations, setAllAnnotations] = useState<Map<string, Annotation[]>>(
    new Map()
  );

  // === STATE MỚI: Quản lý Classes và Keypoints ===
  const [classes, setClasses] = useState<ClassInfo[]>(INITIAL_CLASSES);
  const [keypointCount, setKeypointCount] = useState<number>(0); // Mặc định là 0
  const [highlightSkip, setHighlightSkip] = useState(false); // State cho highlight

  // === MỚI: Ref để theo dõi chế độ của ToolContainer ===
  const toolModeRef = useRef<"draw_box" | "add_keypoints">("draw_box");


  // Lấy danh sách nhãn cho ảnh đang được chọn
  const currentAnnotations =
    allAnnotations.get(selectedImage?.name || "") || [];

  // === CÁC HÀM CẬP NHẬT MỚI ===

  // Cập nhật nhãn (cho 1 ảnh)
  const handleSingleFileAnnotationsChange = (newAnns: Annotation[]) => {
    if (!selectedImage) return;
    const newMap = new Map(allAnnotations);
    newMap.set(selectedImage.name, newAnns);
    setAllAnnotations(newMap);
  };

  // Cập nhật hàng loạt (khi import)
  const handleBulkAnnotationsUpdate = (newAnnotationsMap: Map<string, Annotation[]>) => {
    setAllAnnotations(new Map([...allAnnotations, ...newAnnotationsMap]));
  };

  // Cập nhật danh sách class (khi thêm/sửa)
  const handleClassesChange = (newClasses: ClassInfo[]) => {
    setClasses(newClasses);
  };

  // === MỚI: Xử lý thay đổi số lượng KPT (Quan trọng) ===
  const handleKeypointCountChange = (newCount: number) => {
    if (newCount === keypointCount) return; // Không thay đổi

    // (Bạn đã bỏ comment confirm, tôi giữ nguyên)
    // if (
    //   confirm(
    //     `Changing keypoint count from ${keypointCount} to ${newCount} will CLEAR ALL existing annotations (including imported ones). Are you sure?`
    //   )
    // ) {
    setKeypointCount(newCount);
    setAllAnnotations(new Map()); // Xóa tất cả nhãn

    // Kích hoạt highlight nếu thêm KPT
    if (newCount > keypointCount && newCount > 0) {
      setHighlightSkip(true);
      setTimeout(() => setHighlightSkip(false), 2000); // Tắt highlight sau 2s
    }
    // }
  };

  // Cập nhật kích thước ảnh
  const handleImageLoad = (size: {
    naturalW: number;
    naturalH: number;
    displayW: number;
    displayH: number;
  }) => {
    if (size.naturalW > 1 && size.naturalH > 1) {
      setImgNaturalSize({
        naturalW: size.naturalW,
        naturalH: size.naturalH,
      });
    }
  };

  // === MỚI: Callback để ToolContainer cập nhật mode ===
  const handleModeChange = (mode: "draw_box" | "add_keypoints") => {
    toolModeRef.current = mode;
  };


  // === CẬP NHẬT: events (Xử lý xung đột phím Space) ===
  const inputRef = useRef<InputContainerHandle>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // MỚI: Nếu đang ở chế độ gán KPT, không làm gì cả (ToolContainer sẽ xử lý)
      if (toolModeRef.current === "add_keypoints") {
        return;
      }

      // Nếu không ở chế độ gán KPT, các phím này hoạt động bình thường
      if (e.code === "Space" && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.nextImage();
      }
      if (e.code === "Space" && e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.prevImage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Ref không cần là dependency

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
              onFileSelect={setSelectedImage}
              onFilesChange={setAllFiles}
              isWidthCollapsed={leftWidth === 100}
            ></InputContainer>
          </div>
        )}
      </div>

      {/* Middle panel (Cập nhật props cho ToolContainer) */}
      <div className="flex-1 bg-white p-2 flex flex-col gap-2">
        <ToolContainer
          file={selectedImage}
          annotations={currentAnnotations}
          onAnnotationsChange={handleSingleFileAnnotationsChange}
          onImageLoad={handleImageLoad}
          // Props mới cho classes và keypoints
          classes={classes}
          onClassesChange={handleClassesChange}
          keypointCount={keypointCount}
          onKeypointCountChange={handleKeypointCountChange}
          onModeChange={handleModeChange} // <-- THÊM PROP MỚI
        />

        {/* Hotkeys*/}
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
      </div>

      {/* Right panel (Cập nhật props cho OutputContainer) */}
      <div style={{ width: rightWidth }} className="relative bg-gray-200 shadow-inner">
        <div className="p-2">
          <OutputContainer
            imageName={selectedImage?.name || ""}
            imageSize={imgNaturalSize}
            annotations={currentAnnotations}
            onAnnotationsChange={handleSingleFileAnnotationsChange}
            // Props mới cho import
            classes={classes}
            allImageFiles={allFiles}
            onBulkAnnotationsUpdate={handleBulkAnnotationsUpdate}
            keypointCount={keypointCount} // <-- MỚI: Truyền số KPT
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
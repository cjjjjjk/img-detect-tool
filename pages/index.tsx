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
  keypoint: Keypoint | null; // Điểm keypoint
}

// Kích thước ảnh
export interface ImageSize {
  naturalW: number;
  naturalH: number;
}

export default function Home() {
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(300);
  const [draggingRight, setDraggingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // handle drag for right panel (Không thay đổi)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRight && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        if (newWidth > 250 && newWidth < 600) {
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

  // === THAY ĐỔI LOGIC STATE ===

  // file handling
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // State mới: Lưu trữ kích thước natural của ảnh
  const [imgNaturalSize, setImgNaturalSize] = useState<ImageSize>({
    naturalW: 1,
    naturalH: 1,
  });

  // State mới: Lưu trữ TẤT CẢ các nhãn, dùng Map với key là tên file
  const [allAnnotations, setAllAnnotations] = useState<Map<string, Annotation[]>>(
    new Map()
  );

  // Lấy danh sách nhãn cho ảnh đang được chọn
  const currentAnnotations =
    allAnnotations.get(selectedImage?.name || "") || [];

  // Hàm callback mới để ToolContainer và OutputContainer cập nhật danh sách nhãn
  const handleAnnotationsChange = (newAnns: Annotation[]) => {
    if (!selectedImage) return;
    // Tạo một Map mới để kích hoạt re-render
    const newMap = new Map(allAnnotations);
    newMap.set(selectedImage.name, newAnns);
    setAllAnnotations(newMap);
  };

  // Hàm callback mới để ToolContainer báo cáo kích thước ảnh
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

  // events (Không thay đổi)
  const inputRef = useRef<InputContainerHandle>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, []);

  // Xóa console.log cũ
  // useEffect(() => {
  //   console.log("Oke", imageDataOutput)
  // }, [imageDataOutput])

  return (
    <div
      ref={containerRef}
      className={`${geistSans.className} ${geistMono.className} font-sans flex h-screen bg-gray-100`}
    >
      {/* Left panel (Cập nhật style) */}
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
              isWidthCollapsed={leftWidth === 100}
            ></InputContainer>
          </div>
        )}
      </div>

      {/* Middle panel (Cập nhật props cho ToolContainer) */}
      <div className="flex-1 bg-white p-2 flex flex-col gap-2">
        <ToolContainer
          file={selectedImage}
          annotations={currentAnnotations} // Truyền các nhãn hiện tại
          onAnnotationsChange={handleAnnotationsChange} // Truyền hàm callback cập nhật
          onImageLoad={handleImageLoad} // Truyền hàm callback lấy kích thước
        />

        <div className="mt-2 p-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-700 shadow-sm">
          <h3 className="font-semibold mb-2 text-gray-800">Hotkeys & Tips</h3>
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
              Draw Bounding Box
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 text-gray-800 rounded font-mono text-xs">Right-click</kbd>:
              Assign Keypoint (after drawing box)
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
            onAnnotationsChange={handleAnnotationsChange}
          />
        </div>
        {/* Drag handle (Cập nhật style) */}
        <div
          onMouseDown={() => setDraggingRight(true)}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors duration-200"
        />
      </div>
    </div>
  );
}
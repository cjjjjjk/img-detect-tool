"use client";
import { useState, useRef, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import InputContainer from "@/components/inputContainer";
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

export interface imgObjectData {
  name: string,
  x: number,
  y: number,
  w: number,
  h: number
}

export default function Home() {
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(400);
  const [draggingRight, setDraggingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // handle drag for right panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRight && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        if (newWidth > 150 && newWidth < 600) {
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



  // file handling
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageDataOutput, setImageDataOutput] = useState<imgObjectData | null>(null)

  useEffect(() => {
    console.log(imageDataOutput)
  }, [imageDataOutput])
  return (
    <div
      ref={containerRef}
      className={`${geistSans.className} ${geistMono.className} font-sans flex h-screen`}
    >
      {/* Left panel with collapse */}
      <div
        style={{ width: leftWidth }}
        className="bg-gray-300 transition-all duration-300"
      >
        <button
          onClick={() => setLeftWidth(leftWidth === 50 ? 300 : 50)}
          className="p-2 bg-gray-500 text-white"
        >
          {leftWidth === 50 ? ">>" : "<<"}
        </button>
        {leftWidth > 0 && <div className="p-2">
          <InputContainer
            onFileSelect={setSelectedImage}
          ></InputContainer>
        </div>}
      </div>

      {/* Middle panel */}
      <div className="flex-1 bg-white p-1">
        <ToolContainer
          file={selectedImage}
          onDataOutput={setImageDataOutput}
        ></ToolContainer>
        <div>
          next: space
        </div>
      </div>

      {/* Right panel with resize */}
      <div
        style={{ width: rightWidth }}
        className="relative bg-gray-300"
      >
        <div className="p-2">
          <OutputContainer
            imgData={imageDataOutput}
          ></OutputContainer>
        </div>
        {/* Drag handle */}
        <div
          onMouseDown={() => setDraggingRight(true)}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-gray-400"
        />
      </div>
    </div>
  );
}

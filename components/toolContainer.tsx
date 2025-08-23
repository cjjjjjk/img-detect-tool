"use client";

import { imgObjectData } from "@/pages";
import { useEffect, useRef, useState } from "react";

interface ToolContainerProps {
    file: File | null;
    onDataOutput: (data: imgObjectData) => void;
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

export default function ToolContainer({ file, onDataOutput }: ToolContainerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imgWrapperRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentBox, setCurrentBox] = useState<Box | null>(null);

    const [imgSize, setImgSize] = useState<{ naturalW: number; naturalH: number; displayW: number; displayH: number }>({
        naturalW: 1,
        naturalH: 1,
        displayW: 1,
        displayH: 1,
    });

    const url = file ? URL.createObjectURL(file) : null;

    const clampToWrapper = (clientX: number, clientY: number) => {
        if (!imgWrapperRef.current) return { x: 0, y: 0 };
        const rect = imgWrapperRef.current.getBoundingClientRect();

        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

        return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!file || !imgWrapperRef.current) return;

        const rect = imgWrapperRef.current.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > rect.width) x = rect.width;
        if (y > rect.height) y = rect.height;

        setStartPos({ x, y });
        setCurrentBox({
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
        if (!startPos || !file) return;
        const { x: x2, y: y2 } = clampToWrapper(e.clientX, e.clientY);

        const w = Math.abs(x2 - startPos.x);
        const h = Math.abs(y2 - startPos.y);
        const x = Math.min(startPos.x, x2);
        const y = Math.min(startPos.y, y2);

        // scale sang natural
        const scaleX = imgSize.naturalW / imgSize.displayW;
        const scaleY = imgSize.naturalH / imgSize.displayH;

        setCurrentBox({
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
        if (currentBox && file) {
            // top-left
            const realX = Math.min(currentBox.realX, currentBox.realX + currentBox.realW);
            const realY = Math.min(currentBox.realY, currentBox.realY + currentBox.realH);
            const realW = Math.abs(currentBox.realW);
            const realH = Math.abs(currentBox.realH);

            console.log({
                name: file.name,
                x: realX,
                y: realY,
                w: realW,
                h: realH,
            });

            onDataOutput({
                name: file.name,
                x: realX,
                y: realY,
                w: realW,
                h: realH,
            })

            // reupdate
            setCurrentBox({
                ...currentBox,
                realX,
                realY,
                realW,
                realH,
                x: Math.min(currentBox.x, currentBox.x + currentBox.w),
                y: Math.min(currentBox.y, currentBox.y + currentBox.h),
                w: Math.abs(currentBox.w),
                h: Math.abs(currentBox.h),
            });
        }
        setStartPos(null);
    };


    const handleImageLoad = () => {
        if (imgRef.current) {
            const newSize = {
                naturalW: imgRef.current.naturalWidth,
                naturalH: imgRef.current.naturalHeight,
                displayW: imgRef.current.clientWidth,
                displayH: imgRef.current.clientHeight,
            };

            setImgSize(prev => {
                if (
                    prev.naturalW === newSize.naturalW &&
                    prev.naturalH === newSize.naturalH &&
                    prev.displayW === newSize.displayW &&
                    prev.displayH === newSize.displayH
                ) {
                    return prev;
                }
                return newSize;
            });
        }
    };

    // file change
    useEffect(() => {
        setCurrentBox(null);
    }, [file]);

    // image display resize
    useEffect(() => {
        if (!currentBox) return;

        // re scale
        const scaleX = imgSize.displayW / imgSize.naturalW;
        const scaleY = imgSize.displayH / imgSize.naturalH;

        setCurrentBox({
            ...currentBox,
            x: Math.round(currentBox.realX * scaleX),
            y: Math.round(currentBox.realY * scaleY),
            w: Math.round(currentBox.realW * scaleX),
            h: Math.round(currentBox.realH * scaleY),
        });
    }, [imgSize]);
    return (
        <div
            ref={containerRef}
            className="tool-container relative border border-dashed p-4 rounded h-[90%] bg-gray-100/80"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {!file ? (
                <div className="p-4 border w-[100%] text-gray-500">
                    no img select
                </div>
            ) : (
                <div >
                    <p className="mt-2 text-sm text-center truncate flex">{file.name}
                        <span className="absolute top-0 left-0 bg-amber-300 text-black text-[10px] px-1">{`h:${imgSize.naturalH} w:${imgSize.naturalW}`}</span>
                    </p>
                    <div ref={imgWrapperRef} className="relative border w-fit min-w-[80vh] border-gray-300">
                        <img
                            ref={imgRef}
                            src={url || ""}
                            alt={file.name}
                            onLoad={handleImageLoad}
                            className="w-full min-h-[100%] max-h-[100%] object-contain rounded pointer-events-none"
                        />
                        {currentBox && (
                            <div
                                className="absolute border-2 border-red-500 bg-red-500/20"
                                style={{
                                    left: currentBox.x,
                                    top: currentBox.y,
                                    width: currentBox.w,
                                    height: currentBox.h,
                                }}
                            >
                                <span className="absolute top-0 left-0 bg-red-600 text-white text-[10px] px-1">
                                    x:{currentBox.realX}, y:{currentBox.realY}, w:{currentBox.realW}, h:{currentBox.realH}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

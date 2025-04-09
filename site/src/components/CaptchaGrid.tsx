import React, { useState } from "react";

interface CaptchaGridProps {
    images: string[];
    onSelectionChange: (selectedIndicies: number[]) => void;
}

const CaptchaGrid: React.FC<CaptchaGridProps> = ({ images, onSelectionChange }) => {
    const [selectedIndicies, setSelectedIndicies] = useState<number[]>([]);
    const handleSelect = (index: number) => {
        let newSelectedState: number[];
        if (selectedIndicies.includes(index)) {
            newSelectedState = selectedIndicies.filter((i) => i !== index)
        }
        else {
            newSelectedState = [...selectedIndicies, index];
        }
        setSelectedIndicies(newSelectedState); // update local view
        onSelectionChange(newSelectedState); // pass to parent

    }

    return (
        <div className="grid grid-cols-4 gap-2">
            {images.map((imageUrl, idx) => (
                <div
                    key={idx}
                    className={`cursor-pointer overflow-hidden border-2 rounded-md relative ${selectedIndicies.includes(idx) ? "border-blue-500" : "border-transparent"
                        }`}
                    onClick={() => handleSelect(idx)}
                >
                    <img
                        src={imageUrl}
                        alt={`Image ${idx + 1}`}
                        className="w-full h-auto object-cover"
                    />
                    {selectedIndicies.includes(idx) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-white bg-opacity-70 rounded-full p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CaptchaGrid

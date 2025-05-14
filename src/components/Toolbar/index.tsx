import React from 'react';
import TransformControls from './TransformControls';
import { LightButton } from './buttons/LightButton';
import { ShapeButton } from './buttons/ShapeButton';
import { MediaButton } from './buttons/MediaButton';
import { ParticlesButton } from './buttons/ParticlesButton';
import { TextButton } from './buttons/TextButton';
import { ArrayButton } from './buttons/ArrayButton';
import { ImportButton } from './buttons/ImportButton';
import { RenderModeButtons } from './buttons/RenderModeButtons';
import { AnnotationButton } from './buttons/AnnotationButton';

export default function Toolbar() {
  return (
    <div className="w-full bg-[#1e1e1e] border-b border-gray-700 px-1.5 py-1.5 z-10">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
        <TransformControls />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <ImportButton />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <ShapeButton />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <LightButton />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <ParticlesButton />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <ArrayButton />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <AnnotationButton />
        </div>
        <div className="flex items-center gap-1">
          <RenderModeButtons />
        </div>
      </div>
    </div>
  );
}
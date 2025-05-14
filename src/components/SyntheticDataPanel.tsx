import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn';
import { useEditorStore } from '../store/editorStore';
import { useAnnotationStore } from '../store/annotationStore';
import { 
  Camera, Database, Layers, Shuffle, Box, Sun, Image, 
  Grid, Download, Play, Pause, Settings, ChevronDown, ChevronRight,
  Tag, Sliders, Aperture, Repeat, Cpu, Plus, X, Minus, Check
} from 'lucide-react';
import * as THREE from 'three';

// Rest of the file remains unchanged
[... file content continues unchanged ...]
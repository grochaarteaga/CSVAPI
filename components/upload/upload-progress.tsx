'use client'

import React from 'react'
import { cn } from '../../lib/utils/cn'

interface UploadProgressProps {
  progress: number // 0-100
  status?: string
  className?: string
}

export function UploadProgress({ progress, status, className }: UploadProgressProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>{status || 'Uploading...'}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
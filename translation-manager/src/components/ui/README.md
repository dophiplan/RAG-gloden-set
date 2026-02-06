# UI Components

## MultiSelectDropdown

A multi-select dropdown component with checkbox-based selection, tag display, and keyboard navigation.

### Usage

```tsx
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';

const options = [
  { value: 'translation', label: 'Translation' },
  { value: 'review', label: 'Review' },
  { value: 'proofreading', label: 'Proofreading' },
];

function MyComponent() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <MultiSelectDropdown
      options={options}
      selected={selected}
      onChange={setSelected}
      placeholder="Select work scope..."
    />
  );
}
```

### Props

- `options`: Array of `{value: string, label: string}` objects
- `selected`: Array of selected values (string[])
- `onChange`: Callback function when selection changes
- `placeholder`: Optional placeholder text (default: "Select options...")
- `disabled`: Optional boolean to disable the dropdown
- `className`: Optional CSS class names

### Features

- Checkbox-based multi-selection
- Selected items displayed as removable tags
- Keyboard navigation (Arrow keys, Enter, Escape, Tab)
- Click outside to close
- Accessible with ARIA attributes
- Tailwind CSS styling

---

## ProgressBar

A progress bar component with smooth animations and customizable colors.

### Usage

```tsx
import ProgressBar, { ProgressBarWithLabel } from '@/components/ui/ProgressBar';

function MyComponent() {
  return (
    <>
      {/* Simple progress bar */}
      <ProgressBar value={75} color="green" />

      {/* With label */}
      <ProgressBar
        value={50}
        color="blue"
        size="lg"
        showLabel={true}
      />

      {/* With custom label */}
      <ProgressBarWithLabel
        label="Completion Rate"
        value={85}
        color="green"
        size="md"
      />
    </>
  );
}
```

### Props

- `value`: Number between 0-100 (automatically clamped)
- `color`: Optional color - 'blue' | 'green' | 'yellow' | 'red' (default: 'blue')
- `showLabel`: Optional boolean to show percentage label (default: true)
- `size`: Optional size - 'sm' | 'md' | 'lg' (default: 'md')
- `animated`: Optional boolean for smooth animations (default: true)
- `className`: Optional CSS class names

### Features

- Smooth animations with transition
- Auto-clamps values between 0-100
- Multiple color options
- Three size variants
- Optional percentage label
- Shimmer effect animation
- Helper component `ProgressBarWithLabel` for labeled progress bars

---

## FileUploader

A unified file uploader component supporting both PDF and image files with drag and drop.

### Usage

```tsx
import FileUploader, { UploadedFile } from '@/components/FileUploader';

function MyComponent() {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleFilesChange = (uploadedFiles: UploadedFile[]) => {
    setFiles(uploadedFiles);
    console.log('Uploaded files:', uploadedFiles);
  };

  return (
    <FileUploader
      onFilesChange={handleFilesChange}
      maxPdfFiles={1}
      maxImageFiles={5}
    />
  );
}
```

### Props

- `onFilesChange`: Callback function when files are added or removed
- `maxPdfFiles`: Optional maximum PDF files (default: 1)
- `maxImageFiles`: Optional maximum image files (default: 5)
- `className`: Optional CSS class names

### Features

- Drag and drop support
- Multiple file selection
- PDF support (1 file by default)
- Image support (PNG, JPEG, JPG, GIF, WEBP - 5 files by default)
- Image preview thumbnails
- Individual file removal
- File size display (formatted)
- File type display
- Max 10MB per file validation
- File type validation
- Error handling and display
- Current file count display

### Types

```tsx
interface UploadedFile {
  file: File;
  preview?: string; // Data URL for image preview
  id: string;
}
```

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Function to convert filename to camelCase
function toCamelCase(str) {
  // Remove file extension, special characters and replace with spaces
  let name = str
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\s]/g, " ")
    .trim();

  // Split by spaces and convert to camelCase
  return name
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

// Main function to rename files
function renameFiles(folderPath) {
  // Get all files in the directory
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    // Create a mapping between old and new filenames
    const renameMap = {};

    // Process each file
    files.forEach((file) => {
      // Check if it's an MP3 or WAV file
      if (
        path.extname(file).toLowerCase() === ".mp3" ||
        path.extname(file).toLowerCase() === ".wav"
      ) {
        // Generate new filename
        const camelCaseName = toCamelCase(file);
        const extension = path.extname(file);
        const newFileName = camelCaseName + extension;

        // Avoid duplication by tracking renames
        if (renameMap[newFileName]) {
          // Add a numeric suffix for duplicates
          const count =
            Object.values(renameMap).filter((name) =>
              name.startsWith(camelCaseName)
            ).length + 1;
          renameMap[file] = `${camelCaseName}${count}${extension}`;
        } else {
          renameMap[file] = newFileName;
        }
      }
    });

    // Perform the renaming
    Object.entries(renameMap).forEach(([oldName, newName]) => {
      const oldPath = path.join(folderPath, oldName);
      const newPath = path.join(folderPath, newName);

      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          console.error(`Error renaming ${oldName}:`, err);
        } else {
          console.log(`Renamed: ${oldName} → ${newName}`);
        }
      });
    });

    console.log(`\nProcessed ${Object.keys(renameMap).length} files`);
    console.log("\nFile mapping (for reference):");
    Object.entries(renameMap).forEach(([oldName, newName]) => {
      console.log(`${oldName} → ${newName}`);
    });
  });
}

// Check if folder path is provided
if (process.argv.length < 3) {
  console.log("Usage: node renameFiles.js <folderPath>");
  process.exit(1);
}

// Get folder path from command line argument
const folderPath = process.argv[2];

// Execute the rename function
console.log(`Renaming MP3 and WAV files in: ${folderPath}\n`);
renameFiles(folderPath);

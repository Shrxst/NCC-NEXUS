#!/usr/bin/env bash

# Steps to use this script in Ubuntu:
# 1. Open Ubuntu from the Start menu or open Windows Terminal and choose Ubuntu.
# 2. Go to your project folder:
#    cd /mnt/c/Projects/NCC-NEXUS/NCC-NEXUS
# 3. Create or edit this file:
#    nano zip_txt_files.sh
# 4. Paste this script into the file.
# 5. Save the file in nano:
#    Press Ctrl+O, then Enter.
# 6. Exit nano:
#    Press Ctrl+X.
# 7. Make the script executable:
#    chmod +x zip_txt_files.sh
# 8. Run the script:
#    ./zip_txt_files.sh
# 9. The script will create a zip archive with the current date and time
#    in this format: YYYYMMDD_HHMM.zip
# 10. Example output file:
#     20260422_1430.zip
#
# Steps to merge file f2 into file f1 in Ubuntu:
# 1. Open Ubuntu from the Start menu or open Windows Terminal and choose Ubuntu.
# 2. Go to the folder that contains f1 and f2:
#    cd /path/to/your/files
# 3. Check that both files exist:
#    ls
# 4. View the contents before merging if needed:
#    cat f1
#    cat f2
# 5. Append the contents of f2 to the end of f1:
#    cat f2 >> f1
# 6. To verify the merge:
#    cat f1
# 7. If you want to keep the original f1 unchanged and create a new merged file:
#    cat f1 f2 > merged_file.txt
# 8. To save and exit after editing any file in nano:
#    Press Ctrl+O, then Enter, then Ctrl+X

set -euo pipefail

archive_name="$(date +%Y%m%d_%H%M).zip"

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' is not installed or not available in PATH." >&2
  exit 1
fi

mapfile -d '' txt_files < <(find . -type f -name '*.txt' -print0)

if [ "${#txt_files[@]}" -eq 0 ]; then
  echo "No .txt files found."
  exit 0
fi

zip -q -- "$archive_name" "${txt_files[@]}"
echo "Created $archive_name with ${#txt_files[@]} .txt file(s)."

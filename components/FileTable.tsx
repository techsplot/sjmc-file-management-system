import React from 'react';
import { TableColumn } from '../types';
import { EyeIcon, PencilIcon, TrashIcon } from './icons';

interface FileTableProps<T extends { id: string }> {
  data: T[];
  columns: TableColumn<T>[];
  onView: (item: T) => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}

const FileTable = <T extends { id: string },>({ data, columns, onView, onEdit, onDelete }: FileTableProps<T>) => {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                scope="col"
                className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={`${item.id}-${String(col.key)}`} className="px-6 py-4 whitespace-nowrap">
                  {col.key === 'actions' ? (
                    <div className="flex items-center space-x-4">
                      <button onClick={() => onView(item)} className="text-sjmc-blue hover:text-sjmc-blue-dark" aria-label={`View ${item.id}`}>
                        <EyeIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => onEdit(item)} className="text-gray-600 hover:text-gray-900" aria-label={`Edit ${item.id}`}>
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => onDelete(item)} className="text-red-600 hover:text-red-800" aria-label={`Delete ${item.id}`}>
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ) : col.render ? (
                    col.render(item)
                  ) : (
                    <div className="text-sm text-gray-900">{(item as any)[col.key]}</div>
                  )}
                </td>
              ))}
            </tr>
          ))}
           {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-sm text-center text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  );
};

export default FileTable;

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  saveCategoryAction,
  saveSubcategoryAction,
  toggleCategoryStatusAction,
} from "@/actions/master.actions";
import { Plus, Edit2, FolderTree, Layers, CheckCircle2, AlertCircle } from "lucide-react";

interface SubcategoryItem {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  subcategories: SubcategoryItem[];
  _count: { expenseItems: number };
}

export function CategoriesClientView({
  initialCategories,
}: {
  initialCategories: CategoryItem[];
}) {
  const router = useRouter();

  // Modal States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");

  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState<CategoryItem | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<SubcategoryItem | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCode, setSubcategoryCode] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Category save handler
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await saveCategoryAction({
        id: editingCategory?.id,
        name: categoryName.toUpperCase().trim(),
        code: categoryCode.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_"),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save category.");
      } else {
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCategoryName("");
        setCategoryCode("");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Subcategory save handler
  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentCategory) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await saveSubcategoryAction({
        id: editingSubcategory?.id,
        categoryId: selectedParentCategory.id,
        name: subcategoryName.toUpperCase().trim(),
        code: subcategoryCode.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_"),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save subcategory.");
      } else {
        setShowSubcategoryModal(false);
        setEditingSubcategory(null);
        setSelectedParentCategory(null);
        setSubcategoryName("");
        setSubcategoryCode("");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCategory = async (categoryId: string, currentStatus: boolean) => {
    await toggleCategoryStatusAction(categoryId, !currentStatus);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Action */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Configured Category Groups ({initialCategories.length})
        </p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditingCategory(null);
            setCategoryName("");
            setCategoryCode("");
            setShowCategoryModal(true);
          }}
          className="text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add New Category
        </Button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {initialCategories.map((cat) => (
          <Card key={cat.id} className="shadow-sm border-slate-200">
            <CardHeader className="py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900 uppercase">
                  {cat.name}
                </CardTitle>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {cat.code}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={cat.isActive ? "success" : "secondary"}>
                  {cat.isActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setCategoryName(cat.name);
                    setCategoryCode(cat.code);
                    setShowCategoryModal(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                  title="Edit Category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Subcategories ({cat.subcategories.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedParentCategory(cat);
                    setEditingSubcategory(null);
                    setSubcategoryName("");
                    setSubcategoryCode("");
                    setShowSubcategoryModal(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add Subcategory
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {cat.subcategories.map((sub) => (
                  <span
                    key={sub.id}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-slate-100 text-slate-800 rounded border border-slate-200 uppercase"
                  >
                    {sub.name}
                    <button
                      onClick={() => {
                        setSelectedParentCategory(cat);
                        setEditingSubcategory(sub);
                        setSubcategoryName(sub.name);
                        setSubcategoryCode(sub.code);
                        setShowSubcategoryModal(true);
                      }}
                      className="text-slate-400 hover:text-blue-600"
                      title="Edit Subcategory"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>{cat._count.expenseItems} expenses recorded in this category</span>
                <button
                  type="button"
                  onClick={() => handleToggleCategory(cat.id, cat.isActive)}
                  className="text-slate-600 hover:text-blue-600 font-medium underline"
                >
                  {cat.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? "Edit Category" : "Add Expense Category"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
          <Input
            label="Category Name (UPPERCASE)"
            required
            placeholder="e.g. TRAVEL, LOGISTICS"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value.toUpperCase());
              if (!editingCategory) {
                setCategoryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "_"));
              }
            }}
          />

          <Input
            label="Category Code"
            required
            placeholder="e.g. TRAVEL, LOGISTICS"
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCategoryModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        title={
          editingSubcategory
            ? `Edit Subcategory (${selectedParentCategory?.name})`
            : `Add Subcategory under ${selectedParentCategory?.name}`
        }
        maxWidth="md"
      >
        <form onSubmit={handleSaveSubcategory} className="space-y-4 pt-2">
          <Input
            label="Subcategory Name (UPPERCASE)"
            required
            placeholder="e.g. AIRFARE, TAXI / CAB"
            value={subcategoryName}
            onChange={(e) => {
              setSubcategoryName(e.target.value.toUpperCase());
              if (!editingSubcategory) {
                setSubcategoryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "_"));
              }
            }}
          />

          <Input
            label="Subcategory Code"
            required
            placeholder="e.g. AIRFARE, TAXI_CAB"
            value={subcategoryCode}
            onChange={(e) => setSubcategoryCode(e.target.value.toUpperCase())}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSubcategoryModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Save Subcategory
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

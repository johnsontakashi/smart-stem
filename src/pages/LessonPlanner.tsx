import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Clock, BookOpen, CheckCircle2, Edit, Copy, Trash2, Plus, FileText, Loader2, Sparkles } from "lucide-react";
import api from "@/lib/axios";
import { toast } from "sonner";

interface Subject {
  id: number;
  name: string;
  chapters: Chapter[];
}

interface Chapter {
  id: number;
  name: string;
  order: number;
}

interface LessonPlanType {
  id: number;
  teacher_id: number;
  chapter_id: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  objectives: any[];
  introduction: string | null;
  main_content: string | null;
  activities: any[];
  assessment: string | null;
  homework: string | null;
  resources: any[];
  materials_needed: string[];
  ai_generated: boolean;
  is_published: boolean;
  created_at: string;
}

export default function LessonPlanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanType | null>(null);
  const [activeTab, setActiveTab] = useState("generate");

  // My Lessons state
  const [myLessons, setMyLessons] = useState<LessonPlanType[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Subject/Chapter state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [formData, setFormData] = useState({
    duration_minutes: 60,
    student_level: "undergraduate",
    learning_objectives: "",
    additional_notes: ""
  });

  useEffect(() => {
    loadSubjects();
    loadMyLessons();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      const subject = subjects.find(s => s.id === selectedSubject);
      if (subject) {
        setChapters(subject.chapters || []);
        setSelectedChapter(null);
      }
    }
  }, [selectedSubject, subjects]);

  const loadSubjects = async () => {
    try {
      const response = await api.get('/subjects/');
      const subjectsData = response.data.subjects || response.data || [];
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast.error('Failed to load subjects');
    }
  };

  const loadMyLessons = async () => {
    setLoadingLessons(true);
    try {
      const response = await api.get('/lesson-plans/');
      setMyLessons(response.data || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Failed to load your lesson plans');
    } finally {
      setLoadingLessons(false);
    }
  };

  const generateLessonPlan = async () => {
    if (!selectedChapter) {
      toast.error('Please select a chapter first');
      return;
    }

    setGenerating(true);

    try {
      const objectives = formData.learning_objectives
        ? formData.learning_objectives.split("\n").filter(o => o.trim())
        : [];

      const response = await api.post("/lesson-plans/generate-ai", {
        chapter_id: selectedChapter,
        duration_minutes: formData.duration_minutes,
        learning_objectives: objectives,
        student_level: formData.student_level,
        additional_notes: formData.additional_notes || null
      });

      setLessonPlan(response.data);
      toast.success(t('lessonPlanner.planGenerated'));
      // Reload my lessons list
      await loadMyLessons();
    } catch (error: any) {
      console.error("Error generating lesson plan:", error);
      toast.error(error.response?.data?.detail || t('lessonPlanner.failedToGenerate'));
    } finally {
      setGenerating(false);
    }
  };

  const duplicateLessonPlan = async (planId: number) => {
    setDuplicating(planId);
    try {
      const response = await api.post(`/lesson-plans/${planId}/duplicate`);
      toast.success('Lesson plan duplicated successfully!');
      await loadMyLessons();
      // Switch to My Lessons tab to show the duplicate
      setActiveTab("my-lessons");
    } catch (error: any) {
      console.error('Error duplicating lesson plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to duplicate lesson plan');
    } finally {
      setDuplicating(null);
    }
  };

  const deleteLessonPlan = async (planId: number) => {
    if (!confirm('Are you sure you want to delete this lesson plan?')) {
      return;
    }

    setDeleting(planId);
    try {
      await api.delete(`/lesson-plans/${planId}`);
      toast.success('Lesson plan deleted successfully!');
      await loadMyLessons();
      if (lessonPlan?.id === planId) {
        setLessonPlan(null);
      }
    } catch (error: any) {
      console.error('Error deleting lesson plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete lesson plan');
    } finally {
      setDeleting(null);
    }
  };

  const publishLessonPlan = async (planId: number) => {
    try {
      await api.patch(`/lesson-plans/${planId}/publish`);
      toast.success('Lesson plan published successfully!');
      await loadMyLessons();
    } catch (error: any) {
      console.error('Error publishing lesson plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to publish lesson plan');
    }
  };

  const viewLessonPlan = (plan: LessonPlanType) => {
    setLessonPlan(plan);
    setActiveTab("generate"); // Switch to view
  };

  const getChapterName = (chapterId: number) => {
    for (const subject of subjects) {
      const chapter = subject.chapters?.find(c => c.id === chapterId);
      if (chapter) return `${subject.name} - ${chapter.name}`;
    }
    return `Chapter ${chapterId}`;
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('lessonPlanner.title')}</h1>
        <p className="text-muted-foreground">
          {t('lessonPlanner.description')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate New
          </TabsTrigger>
          <TabsTrigger value="my-lessons">
            <FileText className="h-4 w-4 mr-2" />
            My Lessons ({myLessons.length})
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {t('lessonPlanner.generatePlan')}
                </CardTitle>
                <CardDescription>{t('lessonPlanner.configurePlan')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subject Selection */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select
                    value={selectedSubject?.toString()}
                    onValueChange={(v) => setSelectedSubject(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chapter Selection */}
                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter</Label>
                  <Select
                    value={selectedChapter?.toString()}
                    onValueChange={(v) => setSelectedChapter(parseInt(v))}
                    disabled={!selectedSubject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedSubject ? "Choose a chapter" : "Select subject first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {chapters.map(chapter => (
                        <SelectItem key={chapter.id} value={chapter.id.toString()}>
                          {chapter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">{t('lessonPlanner.duration')}</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">{t('lessonPlanner.studentLevel')}</Label>
                  <Select
                    value={formData.student_level}
                    onValueChange={(value) => setFormData({ ...formData, student_level: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="undergraduate">{t('lessonPlanner.undergraduate')}</SelectItem>
                      <SelectItem value="graduate">{t('lessonPlanner.graduate')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objectives">{t('lessonPlanner.learningObjectives')}</Label>
                  <Textarea
                    id="objectives"
                    placeholder={t('lessonPlanner.objectivesPlaceholder')}
                    rows={4}
                    value={formData.learning_objectives}
                    onChange={(e) => setFormData({ ...formData, learning_objectives: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('lessonPlanner.additionalNotes')}</Label>
                  <Textarea
                    id="notes"
                    placeholder={t('lessonPlanner.notesPlaceholder')}
                    rows={3}
                    value={formData.additional_notes}
                    onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                  />
                </div>

                <Button
                  onClick={generateLessonPlan}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('lessonPlanner.generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t('lessonPlanner.generateAIPlan')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Lesson Plan Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {t('lessonPlanner.generatedPlan')}
                </CardTitle>
                <CardDescription>{t('lessonPlanner.aiGeneratedPlan')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!lessonPlan ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('lessonPlanner.generateToSeeResults')}</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                    {/* Action Buttons */}
                    <div className="flex gap-2 pb-4 border-b">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teacher/lesson-planner/edit/${lessonPlan.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateLessonPlan(lessonPlan.id)}
                        disabled={duplicating === lessonPlan.id}
                      >
                        {duplicating === lessonPlan.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Duplicate
                      </Button>
                      {!lessonPlan.is_published && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => publishLessonPlan(lessonPlan.id)}
                        >
                          Publish
                        </Button>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-2">{lessonPlan.title}</h3>
                      <p className="text-sm text-muted-foreground">{lessonPlan.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{t('lessonPlanner.durationMinutes', { minutes: lessonPlan.duration_minutes })}</span>
                        </div>
                        {lessonPlan.ai_generated && (
                          <Badge variant="secondary">AI Generated</Badge>
                        )}
                        <Badge variant={lessonPlan.is_published ? "default" : "outline"}>
                          {lessonPlan.is_published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                    </div>

                    {lessonPlan.objectives && lessonPlan.objectives.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.learningObjectivesSection')}</h4>
                        <ul className="space-y-1">
                          {lessonPlan.objectives.map((obj: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                              <span>{obj.description} <Badge className="ml-2 text-xs">{obj.bloom_level}</Badge></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lessonPlan.introduction && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.introduction')}</h4>
                        <p className="text-sm whitespace-pre-wrap">{lessonPlan.introduction}</p>
                      </div>
                    )}

                    {lessonPlan.main_content && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.mainContent')}</h4>
                        <p className="text-sm whitespace-pre-wrap">{lessonPlan.main_content}</p>
                      </div>
                    )}

                    {lessonPlan.activities && lessonPlan.activities.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.activities')}</h4>
                        <div className="space-y-3">
                          {lessonPlan.activities.map((activity: any, idx: number) => (
                            <div key={idx} className="border-l-2 border-primary pl-3">
                              <p className="font-medium text-sm">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                              <span className="text-xs text-muted-foreground">{t('lessonPlanner.activityDuration', { duration: activity.duration })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lessonPlan.assessment && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.assessment')}</h4>
                        <p className="text-sm whitespace-pre-wrap">{lessonPlan.assessment}</p>
                      </div>
                    )}

                    {lessonPlan.homework && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.homework')}</h4>
                        <p className="text-sm whitespace-pre-wrap">{lessonPlan.homework}</p>
                      </div>
                    )}

                    {lessonPlan.materials_needed && lessonPlan.materials_needed.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">{t('lessonPlanner.materialsNeeded')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {lessonPlan.materials_needed.map((material: string, idx: number) => (
                            <Badge key={idx} variant="outline">{material}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* My Lessons Tab */}
        <TabsContent value="my-lessons">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Lesson Plans
              </CardTitle>
              <CardDescription>
                View, edit, duplicate, and manage your saved lesson plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLessons ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading your lesson plans...</p>
                </div>
              ) : myLessons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No lesson plans yet.</p>
                  <p className="text-sm mt-2">Generate your first AI-powered lesson plan!</p>
                  <Button
                    className="mt-4"
                    onClick={() => setActiveTab("generate")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Lesson Plan
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myLessons.map((plan) => (
                    <div
                      key={plan.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{plan.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {plan.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">
                              {getChapterName(plan.chapter_id)}
                            </Badge>
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              {plan.duration_minutes} min
                            </Badge>
                            {plan.ai_generated && (
                              <Badge variant="secondary">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Generated
                              </Badge>
                            )}
                            <Badge variant={plan.is_published ? "default" : "outline"}>
                              {plan.is_published ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(plan.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewLessonPlan(plan)}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/teacher/lesson-planner/edit/${plan.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateLessonPlan(plan.id)}
                            disabled={duplicating === plan.id}
                          >
                            {duplicating === plan.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteLessonPlan(plan.id)}
                            disabled={deleting === plan.id}
                            className="text-red-600 hover:text-red-700"
                          >
                            {deleting === plan.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

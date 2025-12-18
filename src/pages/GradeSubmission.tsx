import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  ArrowLeft,
  User,
  Calendar,
  Award,
  Save,
  AlertCircle,
  CheckCircle,
  FileCheck,
  Download,
  Sparkles,
  ListChecks,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Submission {
  id: number;
  assignment_id: number;
  assignment_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  content: string | null;
  file_url: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  is_flagged: boolean;
  plagiarism_score: number | null;
}

interface RubricCriterion {
  name: string;
  weight: number;
  description?: string;
}

interface Rubric {
  criteria: RubricCriterion[];
}

interface Assignment {
  id: number;
  title: string;
  chapter_name: string;
  subject_name: string;
  max_score: number;
  rubric?: Rubric | null;
  expected_answers?: Record<string, any> | null;
  instructions?: string | null;
}

const GradeSubmission: React.FC = () => {
  const { t } = useTranslation();
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);

  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [showRubric, setShowRubric] = useState(true);
  const [showExpectedAnswers, setShowExpectedAnswers] = useState(false);

  useEffect(() => {
    loadData();
  }, [submissionId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load submission
      const submissionResponse = await api.get(`/submissions/${submissionId}`);
      const submissionData = submissionResponse.data;
      setSubmission(submissionData);

      // Load assignment
      const assignmentResponse = await api.get(`/assignments/${submissionData.assignment_id}`);
      setAssignment(assignmentResponse.data);

      // Pre-fill grade and feedback if already graded
      if (submissionData.grade !== null) {
        setGrade(submissionData.grade.toString());
        setFeedback(submissionData.feedback || '');
      }
    } catch (error: any) {
      toast.error(t('submissions.submissionsFailed'));
      console.error(error);
      navigate('/assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async () => {
    try {
      const response = await api.get(`/submissions/${submissionId}/download`, {
        responseType: 'blob',
      });

      // Create a blob from the response
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      // Get filename from file_url
      const filename = submission?.file_url?.split('/').pop() || 'submission_file';

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('submissions.downloadSuccess'));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('submissions.downloadError'));
    }
  };

  const handleAIGrade = async () => {
    if (!submission?.content && !submission?.file_url) {
      toast.error('Cannot use AI grading: Submission has no content');
      return;
    }

    setAiGrading(true);

    try {
      const response = await api.post(`/submissions/${submissionId}/ai-grade`);
      const gradedSubmission = response.data;

      // Update local state with AI-generated grade and feedback
      setGrade(gradedSubmission.grade.toString());
      setFeedback(gradedSubmission.feedback || '');

      toast.success('AI grading completed successfully! Review and adjust if needed.');

      // Reload the submission data
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'AI grading failed');
      console.error(error);
    } finally {
      setAiGrading(false);
    }
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!grade || grade.trim() === '') {
      toast.error(t('submissions.gradeRequired'));
      return;
    }

    const gradeValue = parseFloat(grade);

    if (isNaN(gradeValue) || gradeValue < 0) {
      toast.error(t('submissions.gradePositive'));
      return;
    }

    if (assignment && gradeValue > assignment.max_score) {
      toast.error(t('submissions.gradeExceedsMax', { max: assignment.max_score }));
      return;
    }

    setGrading(true);

    try {
      await api.post(`/submissions/${submissionId}/grade`, {
        grade: gradeValue,
        feedback: feedback.trim() || null,
      });

      toast.success(t('submissions.gradeSuccess'));
      navigate(`/teacher/assignment/${assignment?.id}/submissions`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('submissions.gradeError'));
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('submissions.loadingSubmission')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!submission || !assignment) return null;

  const isAlreadyGraded = submission.grade !== null;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate(`/teacher/assignment/${assignment.id}/submissions`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('submissions.backToSubmissions')}
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('submissions.gradeSubmission')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {assignment.title} • {assignment.subject_name}
          </p>
        </div>
        {isAlreadyGraded && (
          <Badge className="bg-green-500 text-lg py-2 px-4">
            <CheckCircle className="w-4 h-4 mr-1" />
            {t('submissions.alreadyGraded')}
          </Badge>
        )}
      </div>

      {/* Plagiarism Warning Alert */}
      {submission.is_flagged && submission.plagiarism_score && submission.plagiarism_score > 70 && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-semibold">
            🚩 {t('submissions.plagiarismWarning', { score: submission.plagiarism_score.toFixed(1) })}
          </AlertDescription>
        </Alert>
      )}

      {/* Student Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('submissions.studentInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-600">{t('submissions.studentName')}</Label>
            <p className="font-semibold">{submission.student_name}</p>
          </div>
          <div>
            <Label className="text-gray-600">{t('submissions.studentEmail')}</Label>
            <p className="font-semibold">{submission.student_email}</p>
          </div>
          <div>
            <Label className="text-gray-600">{t('submissions.submittedOn')}</Label>
            <p className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          {submission.plagiarism_score !== null && (
            <div>
              <Label className="text-gray-600">{t('submissions.plagiarismScore')}</Label>
              <div className="flex items-center gap-2">
                <p className={`font-semibold text-lg ${
                  submission.plagiarism_score > 70 ? 'text-red-600' :
                  submission.plagiarism_score > 40 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {submission.plagiarism_score.toFixed(1)}%
                </p>
                {submission.is_flagged && (
                  <Badge variant="destructive" className="animate-pulse">
                    🚩 {t('submissions.flagged')}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grading Criteria Section - Rubric & Expected Answers */}
      {(assignment.rubric || assignment.expected_answers) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rubric Criteria Card */}
          {assignment.rubric && assignment.rubric.criteria && assignment.rubric.criteria.length > 0 && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <button
                  type="button"
                  onClick={() => setShowRubric(!showRubric)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <ListChecks className="w-5 h-5" />
                    {t('grading.rubricCriteria') || 'Rubric Criteria'}
                    <Badge variant="secondary" className="ml-2">
                      {assignment.rubric.criteria.length} criteria
                    </Badge>
                  </CardTitle>
                  {showRubric ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <CardDescription>
                  {t('grading.rubricDescription') || 'Use these criteria to evaluate the submission'}
                </CardDescription>
              </CardHeader>
              {showRubric && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {assignment.rubric.criteria.map((criterion, index) => (
                      <div
                        key={index}
                        className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-purple-900 dark:text-purple-100">
                            {criterion.name}
                          </span>
                          <Badge className="bg-purple-500">
                            {criterion.weight}%
                          </Badge>
                        </div>
                        {criterion.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {criterion.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Expected Answers Card */}
          {assignment.expected_answers && Object.keys(assignment.expected_answers).length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <button
                  type="button"
                  onClick={() => setShowExpectedAnswers(!showExpectedAnswers)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Target className="w-5 h-5" />
                    {t('grading.expectedAnswers') || 'Expected Answers'}
                  </CardTitle>
                  {showExpectedAnswers ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <CardDescription>
                  {t('grading.expectedAnswersDescription') || 'Reference solutions for this assignment'}
                </CardDescription>
              </CardHeader>
              {showExpectedAnswers && (
                <CardContent className="pt-0">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <pre className="text-sm whitespace-pre-wrap text-green-900 dark:text-green-100 overflow-auto max-h-64">
                      {typeof assignment.expected_answers === 'string'
                        ? assignment.expected_answers
                        : JSON.stringify(assignment.expected_answers, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* No Grading Criteria Alert */}
      {!assignment.rubric && !assignment.expected_answers && (
        <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            {t('grading.noCriteriaConfigured') || 'No rubric or expected answers configured for this assignment. AI grading will use general criteria.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Submission Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t('submissions.submittedWork')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission.content ? (
            <div>
              <Label>{t('submissions.textContent')}</Label>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-2">
                <p className="whitespace-pre-wrap">{submission.content}</p>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('submissions.noTextContent')}</AlertDescription>
            </Alert>
          )}

          {submission.file_url && (
            <div>
              <Label>{t('submissions.uploadedFile')}</Label>
              <div className="flex items-center justify-between mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {submission.file_url.split('/').pop()}
                    </p>
                    <p className="text-sm text-gray-600">{t('submissions.clickDownload')}</p>
                  </div>
                </div>
                <Button
                  onClick={handleDownloadFile}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('submissions.downloadFile')}
                </Button>
              </div>
            </div>
          )}

          {!submission.content && !submission.file_url && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('submissions.emptySubmission')}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Grading Form */}
      <Card>
        <form onSubmit={handleSubmitGrade}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  {isAlreadyGraded ? t('submissions.updateGrade') : t('submissions.enterGrade')}
                </CardTitle>
                <CardDescription>
                  {t('submissions.maxScoreIs', { max: assignment.max_score })}
                </CardDescription>
              </div>
              {!isAlreadyGraded && (submission.content || submission.file_url) && (
                <Button
                  type="button"
                  onClick={handleAIGrade}
                  disabled={aiGrading}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {aiGrading ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      AI Grading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Grade with AI
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Grade Input */}
            <div>
              <Label htmlFor="grade">
                {t('submissions.gradeOutOf', { max: assignment.max_score })} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="grade"
                type="number"
                min="0"
                max={assignment.max_score}
                step="0.5"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder={t('submissions.enterGradePlaceholder', { max: assignment.max_score })}
                required
                className="mt-2"
              />
            </div>

            {/* Feedback Input */}
            <div>
              <Label htmlFor="feedback">{t('submissions.feedbackOptional')}</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t('submissions.provideFeedbackPlaceholder')}
                rows={6}
                className="mt-2"
              />
            </div>

            {submission.is_flagged && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('submissions.flaggedForReview')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/teacher/assignment/${assignment.id}/submissions`)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={grading}>
              {grading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isAlreadyGraded ? t('submissions.updating') : t('submissions.submitting')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isAlreadyGraded ? t('submissions.updateGrade') : t('submissions.enterGrade')}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default GradeSubmission;

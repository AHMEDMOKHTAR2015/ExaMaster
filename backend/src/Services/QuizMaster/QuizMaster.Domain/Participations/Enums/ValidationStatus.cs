namespace QuizMaster.Domain.Participations;

// A teacher's verdict on a whole submission. Rejected is what reopens an assignment for another attempt.
public enum ValidationStatus
{
    Approved = 1,
    Rejected = 2,
}

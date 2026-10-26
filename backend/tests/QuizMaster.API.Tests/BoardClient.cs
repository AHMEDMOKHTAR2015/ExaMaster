using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR.Client;
using QuizMaster.API.Realtime;

namespace QuizMaster.API.Tests;

// One open page on the teaching-room hub: what it joined, and every message the server sent it, in order.
public sealed class BoardClient : IAsyncDisposable
{
    public static readonly TimeSpan Patience = TimeSpan.FromSeconds(10);

    // How long "nothing arrived" is waited for, once a message sent at the same moment has reached another page.
    public static readonly TimeSpan Grace = TimeSpan.FromMilliseconds(750);

    private readonly HubConnection _connection;
    private readonly Channel<Received> _received = Channel.CreateUnbounded<Received>();

    public sealed record Received(string Method, TeachingRoomStateDto? State = null, int? RoomId = null);

    public BoardClient(HubConnection connection)
    {
        _connection = connection;
        connection.On<TeachingRoomStateDto>(TeachingRoomHub.CurrentItemChanged, state => Record(new(TeachingRoomHub.CurrentItemChanged, state, state.RoomId)));
        connection.On<TeachingRoomStateDto>(TeachingRoomHub.Admitted, state => Record(new(TeachingRoomHub.Admitted, state, state.RoomId)));
        connection.On<int>(TeachingRoomHub.Removed, roomId => Record(new(TeachingRoomHub.Removed, RoomId: roomId)));
        connection.On<int>(TeachingRoomHub.JoinRequestsChanged, roomId => Record(new(TeachingRoomHub.JoinRequestsChanged, RoomId: roomId)));
        connection.On<int>(TeachingRoomHub.RoomEnded, roomId => Record(new(TeachingRoomHub.RoomEnded, RoomId: roomId)));
    }

    public Task<JoinTeachingRoomResult> JoinRoomAsync(int roomId) => _connection.InvokeAsync<JoinTeachingRoomResult>(nameof(TeachingRoomHub.JoinRoom), roomId);

    // The next message the server sent this page, of the method given (other methods in between are skipped).
    public async Task<Received> NextAsync(string method)
    {
        using var timeout = new CancellationTokenSource(Patience);
        while (true)
        {
            var received = await _received.Reader.ReadAsync(timeout.Token);
            if (received.Method == method)
                return received;
        }
    }

    // Asserts the server sent this page nothing at all, waiting out the grace period first.
    public async Task AssertNothingReceivedAsync()
    {
        await Task.Delay(Grace);
        Assert.False(_received.Reader.TryRead(out var received), $"Expected nothing, but received {received}");
    }

    public Task StopAsync() => _connection.StopAsync();

    public ValueTask DisposeAsync() => _connection.DisposeAsync();

    private void Record(Received received) => _received.Writer.TryWrite(received);
}
